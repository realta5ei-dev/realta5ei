import torch
import torch.nn as nn
import math
import re
import numpy as np
import pandas as pd
from torch.utils.data import Dataset, DataLoader, random_split
from tqdm import tqdm
import os


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, seq_len:int, dropout:float) -> None:
        super().__init__()
        pe = torch.zeros(seq_len, d_model)
        position = torch.arange(0, seq_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)
        self.dropout = nn.Dropout(dropout)

    def forward(self,x):
        x = x + self.pe[:, :x.shape[1], :].to(x.device)
        return self.dropout(x)

class LayerNormalization(nn.Module):
    def __init__(self, normalized_shape:int, eps:float = 1e-6):
        super().__init__()
        self.eps = eps
        self.alpha = nn.Parameter(torch.ones(normalized_shape))
        self.bias = nn.Parameter(torch.zeros(normalized_shape))

    def forward(self, x):
        mean = x.mean(-1, keepdim=True)
        std = x.std(-1, keepdim=True)
        return self.alpha * (x - mean) / (std + self.eps) + self.bias

class FeedForwardBlock(nn.Module):
    def __init__(self, d_model: int, d_ff:int, dropout: float) -> None:
        super().__init__()
        self.linear_1 = nn.Linear(d_model, d_ff)
        self.dropout = nn.Dropout(dropout)
        self.linear_2 = nn.Linear(d_ff, d_model)

    def forward(self, x):
        return self.linear_2(self.dropout(torch.relu(self.linear_1(x))))

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, h: int, dropout: float) -> None:
        super().__init__()
        self.h = h
        assert d_model % h == 0
        self.d_k = d_model // h
        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)

    @staticmethod
    def attention(query, key, value, mask, dropout_layer=None):
        d_k = query.size(-1)
        scores = (query @ key.transpose(-2, -1)) / math.sqrt(d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        attn = scores.softmax(dim=-1)
        if dropout_layer is not None:
            attn = dropout_layer(attn)
        return attn @ value, attn

    def forward(self, q, k, v, mask):
        batch = q.size(0)
        seq_len_q = q.size(1)
        seq_len_k = k.size(1)
        query = self.w_q(q)
        key = self.w_k(k)
        value = self.w_v(v)
        query = query.view(batch, seq_len_q, self.h, self.d_k).transpose(1, 2)
        key = key.view(batch, seq_len_k, self.h, self.d_k).transpose(1, 2)
        value = value.view(batch, seq_len_k, self.h, self.d_k).transpose(1, 2)
        if mask is not None:
            if mask.dim() == 2:
                mask = mask.unsqueeze(1).unsqueeze(1)
            elif mask.dim() == 3:
                mask = mask.unsqueeze(1)
            mask = mask.to(query.device)
        x, _ = MultiHeadAttention.attention(query, key, value, mask, dropout_layer=self.dropout)
        x = x.transpose(1, 2).contiguous().view(batch, seq_len_q, self.h * self.d_k)
        return self.w_o(x)

class ResidualConnection(nn.Module):
    def __init__(self, normalized_shape: int, dropout: float) -> None:
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        self.norm = LayerNormalization(normalized_shape)
    def forward(self, x, sublayer):
        return x + self.dropout(sublayer(self.norm(x)))

class EncoderBlock(nn.Module):
    def __init__(self, self_attention_block: MultiHeadAttention, feed_forward_block: FeedForwardBlock, d_model: int, dropout: float) -> None:
        super().__init__()
        self.self_attention_block = self_attention_block
        self.feed_forward_block = feed_forward_block
        self.residual_connection = nn.ModuleList([ResidualConnection(d_model, dropout) for _ in range(2)])

    def forward(self, x, src_mask):
        x = self.residual_connection[0](x, lambda x_: self.self_attention_block(x_, x_, x_, src_mask))
        x = self.residual_connection[1](x, lambda x_: self.feed_forward_block(x_))
        return x

class Encoder(nn.Module):
    def __init__(self, layers: nn.ModuleList, d_model: int) -> None:
        super().__init__()
        self.layers = layers
        self.norm = LayerNormalization(d_model)
    def forward(self, x, mask):
        for layer in self.layers:
            x = layer(x, mask)
        return self.norm(x)

class DecoderBlock(nn.Module):
    def __init__(self, self_attention_block: MultiHeadAttention, cross_attention_block: MultiHeadAttention, feed_forward_block: FeedForwardBlock, d_model: int, dropout: float) -> None:
        super().__init__()
        self.self_attention_block = self_attention_block
        self.cross_attention_block = cross_attention_block
        self.feed_forward_block = feed_forward_block
        self.residual_connections = nn.ModuleList([ResidualConnection(d_model, dropout) for _ in range(3)])

    def forward(self, x, encoder_output, src_mask, tgt_mask):
        x = self.residual_connections[0](x, lambda x_: self.self_attention_block(x_, x_, x_, tgt_mask))
        x = self.residual_connections[1](x, lambda x_: self.cross_attention_block(x_, encoder_output, encoder_output, src_mask))
        x = self.residual_connections[2](x, lambda x_: self.feed_forward_block(x_))
        return x

class Decoder(nn.Module):
    def __init__(self, layers: nn.ModuleList, d_model: int) -> None:
        super().__init__()
        self.layers = layers
        self.norm = LayerNormalization(d_model)
    def forward(self, x, encoder_output, src_mask, tgt_mask):
        for layer in self.layers:
            x = layer(x, encoder_output, src_mask, tgt_mask)
        return self.norm(x)

class TransformerTimeSeries(nn.Module):
    def __init__(self, encoder: Encoder, decoder: Decoder, src_embed: nn.Embedding, tgt_embed: nn.Embedding, src_pos: PositionalEncoding, tgt_pos: PositionalEncoding, projection_layer: nn.Linear) -> None:
        super().__init__()
        self.encoder = encoder
        self.decoder = decoder
        self.src_embed = src_embed
        self.src_pos = src_pos
        self.tgt_pos = tgt_pos
        self.tgt_embed = tgt_embed
        self.projection_layer = projection_layer

    def encode(self, src, src_mask):
        src = self.src_embed(src.long())
        src = self.src_pos(src)
        return self.encoder(src, src_mask)

    def decode(self, encoder_output, src_mask, tgt, tgt_mask):
        tgt = self.tgt_embed(tgt.long())
        tgt = self.tgt_pos(tgt)
        return self.decoder(tgt, encoder_output, src_mask, tgt_mask)
    def project(self, x):
        return self.projection_layer(x)

def casual_mask(size:int, device):
    mask = torch.tril(torch.ones((size, size), dtype=torch.bool, device=device))
    return mask.unsqueeze(0).unsqueeze(0)

def build_transformer_time_series(src_vocab_size: int, tgt_vocab_size: int, src_seq_len: int, tgt_seq_len: int, d_model: int = 128, N: int = 4, h: int = 8, dropout: float = 0.1, d_ff: int = 512):
    src_embed = nn.Embedding(src_vocab_size, d_model, padding_idx=0)
    tgt_embed = nn.Embedding(tgt_vocab_size, d_model, padding_idx=0)
    src_pos = PositionalEncoding(d_model, src_seq_len, dropout)
    tgt_pos = PositionalEncoding(d_model, tgt_seq_len, dropout)
    encoder_blocks = []
    for _ in range(N):
        encoder_self_attention_block = MultiHeadAttention(d_model, h, dropout)
        feed_forward_block = FeedForwardBlock(d_model, d_ff, dropout)
        encoder_block = EncoderBlock(encoder_self_attention_block, feed_forward_block, d_model, dropout)
        encoder_blocks.append(encoder_block)
    decoder_blocks = []
    for _ in range(N):
        decoder_self_attention_block = MultiHeadAttention(d_model, h, dropout)
        decoder_cross_attention_block = MultiHeadAttention(d_model, h, dropout)
        feed_forward_block = FeedForwardBlock(d_model, d_ff, dropout)
        decoder_block = DecoderBlock(decoder_self_attention_block, decoder_cross_attention_block, feed_forward_block, d_model, dropout)
        decoder_blocks.append(decoder_block)
    encoder = Encoder(nn.ModuleList(encoder_blocks), d_model)
    decoder = Decoder(nn.ModuleList(decoder_blocks), d_model)
    projection_layer = nn.Linear(d_model, tgt_vocab_size)
    transformer = TransformerTimeSeries(encoder, decoder, src_embed, tgt_embed, src_pos, tgt_pos, projection_layer)
    for p in transformer.parameters():
        if p.dim() > 1:
            nn.init.xavier_uniform_(p)
    return transformer

class TextDataset(Dataset):
    def __init__(self, csv_path, src_seq_len, tgt_seq_len, max_vocab=30000):
        df = pd.read_csv(csv_path).fillna("")
        texts_src = df["slides"].astype(str).tolist()
        texts_tgt = (df["summary"].astype(str) + " " + df["reflection"].astype(str)).tolist()
        tokenized_src = [self._tokenize(t) for t in texts_src]
        tokenized_tgt = [self._tokenize(t) for t in texts_tgt]
        all_tokens = [tok for seq in (tokenized_src + tokenized_tgt) for tok in seq]
        freq = {}
        for t in all_tokens:
            freq[t] = freq.get(t, 0) + 1
        sorted_tokens = sorted(freq.items(), key=lambda x: -x[1])
        vocab_tokens = [t for t,_ in sorted_tokens][:max_vocab]
        self.idx2tok = ["<pad>", "<sos>", "<eos>", "<unk>"] + vocab_tokens
        self.tok2idx = {t:i for i,t in enumerate(self.idx2tok)}
        self.pad_idx = self.tok2idx["<pad>"]
        self.sos_idx = self.tok2idx["<sos>"]
        self.eos_idx = self.tok2idx["<eos>"]
        self.unk_idx = self.tok2idx["<unk>"]
        self.src_seq_len = src_seq_len
        self.tgt_seq_len = tgt_seq_len
        self.samples = []
        for s_tok, t_tok in zip(tokenized_src, tokenized_tgt):
            src_idx = self._encode_and_pad(s_tok, src_seq_len, add_eos=False)
            tgt_idx = self._encode_and_pad(t_tok, tgt_seq_len-1, add_eos=False)
            tgt_idx = tgt_idx[:tgt_seq_len-1]
            tgt = [self.sos_idx] + tgt_idx
            if len(tgt) < tgt_seq_len:
                tgt = tgt + [self.pad_idx]*(tgt_seq_len - len(tgt))
            label = tgt[1:] + [self.eos_idx]
            label = label[:tgt_seq_len]
            if len(label) < tgt_seq_len:
                label = label + [self.pad_idx]*(tgt_seq_len - len(label))
            self.samples.append((src_idx, tgt, label))

    def _tokenize(self, text):
        text = text.lower()
        toks = re.findall(r"\w+|[^\s\w]", text, re.UNICODE)
        return toks

    def _encode_and_pad(self, toks, length, add_eos=False):
        idxs = []
        for t in toks[:length]:
            idxs.append(self.tok2idx.get(t, self.unk_idx))
        if add_eos and len(idxs) < length:
            idxs.append(self.eos_idx)
        if len(idxs) < length:
            idxs = idxs + [self.pad_idx]*(length - len(idxs))
        return idxs

    def __len__(self):
        return len(self.samples)
    def __getitem__(self, idx):
        src, dec_in, tgt = self.samples[idx]
        return {"encoder_input": torch.tensor(src, dtype=torch.long), "decoder_input": torch.tensor(dec_in, dtype=torch.long), "label": torch.tensor(tgt, dtype=torch.long)}

def collate_fn(batch):
    encoder_inputs = torch.stack([item["encoder_input"] for item in batch], dim=0)
    decoder_inputs = torch.stack([item["decoder_input"] for item in batch], dim=0)
    labels = torch.stack([item["label"] for item in batch], dim=0)
    return {"encoder_input": encoder_inputs, "decoder_input": decoder_inputs, "label": labels}

def greedy_decode_tokens(model, encoder_src, encoder_mask, max_len, device, sos_idx, eos_idx):
    model.eval()
    with torch.no_grad():
        enc_out = model.encode(encoder_src, encoder_mask)
        batch = encoder_src.size(0)
        decoder_input = torch.full((batch, 1), sos_idx, dtype=torch.long, device=device)
        outputs = []
        for _ in range(max_len):
            tgt_mask = casual_mask(decoder_input.size(1), device)
            dec_out = model.decode(enc_out, encoder_mask, decoder_input, tgt_mask)
            logits = model.project(dec_out[:, -1, :])
            next_tokens = logits.argmax(dim=-1, keepdim=True)
            outputs.append(next_tokens)
            decoder_input = torch.cat([decoder_input, next_tokens], dim=1)
        out = torch.cat(outputs, dim=1)
    return out

def train_model():
    csv_path = "myapp/static/dataset.csv"
    src_seq_len = 40
    tgt_seq_len = 20
    batch_size = 32
    num_epochs = 30
    lr = 1e-3
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    dataset = TextDataset(csv_path, src_seq_len, tgt_seq_len)
    val_size = int(0.1 * len(dataset))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, collate_fn=collate_fn)
    src_vocab = len(dataset.idx2tok)
    tgt_vocab = len(dataset.idx2tok)
    model = build_transformer_time_series(src_vocab, tgt_vocab, src_seq_len, tgt_seq_len, d_model=128, N=4, h=8, dropout=0.1, d_ff=512).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss(ignore_index=dataset.pad_idx)
    for epoch in range(num_epochs):
        model.train()
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{num_epochs}")
        train_loss = 0.0
        for batch in pbar:
            encoder_input = batch["encoder_input"].to(device)
            decoder_input = batch["decoder_input"].to(device)
            labels = batch["label"].to(device)
            encoder_mask = None
            tgt_mask = casual_mask(decoder_input.size(1), device)
            enc_out = model.encode(encoder_input, encoder_mask)
            dec_out = model.decode(enc_out, encoder_mask, decoder_input, tgt_mask)
            logits = model.project(dec_out)
            loss = loss_fn(logits.view(-1, logits.size(-1)), labels.view(-1))
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * encoder_input.size(0)
            pbar.set_postfix({'loss': f"{loss.item():.6f}"})
        train_loss = train_loss / len(train_loader.dataset)
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                encoder_input = batch["encoder_input"].to(device)
                decoder_input = batch["decoder_input"].to(device)
                labels = batch["label"].to(device)
                encoder_mask = None
                tgt_mask = casual_mask(decoder_input.size(1), device)
                enc_out = model.encode(encoder_input, encoder_mask)
                dec_out = model.decode(enc_out, encoder_mask, decoder_input, tgt_mask)
                logits = model.project(dec_out)
                loss = loss_fn(logits.view(-1, logits.size(-1)), labels.view(-1))
                val_loss += loss.item() * encoder_input.size(0)
        val_loss = val_loss / len(val_loader.dataset)
        print(f"Epoch {epoch+1} Train Loss {train_loss:.6f} Val Loss {val_loss:.6f}")
        save_path = f"myapp/static/transformer_text_epoch{epoch:02d}.pt"
        torch.save({"epoch": epoch, "model_state_dict": model.state_dict(), "optimizer_state_dict": optimizer.state_dict(), "vocab": dataset.idx2tok}, save_path)

if __name__ == "__main__":
    train_model()
