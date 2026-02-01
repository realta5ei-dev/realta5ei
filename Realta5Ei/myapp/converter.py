import torch
import onnx
import onnxruntime as ort
from ai import build_transformer_time_series

checkpoint = torch.load("myapp/static/transformer_text_epoch29.pt", map_location="cpu")

vocab_size = len(checkpoint["vocab"])
src_seq_len = 40
tgt_seq_len = 20

model = build_transformer_time_series(
    vocab_size,
    vocab_size,
    src_seq_len,
    tgt_seq_len,
    128,
    4,
    8,
    0.1,
    512
)


class TransformerWrapper(torch.nn.Module):
    def __init__(self, transformer):
        super().__init__()
        self.transformer = transformer

    def forward(self, src, tgt):
        src_mask = torch.ones(src.size(0), 1, 1, src.size(1), dtype=torch.bool, device=src.device)
        tgt_seq_len = tgt.size(1)
        tgt_mask = torch.tril(torch.ones(tgt_seq_len, tgt_seq_len, dtype=torch.bool, device=tgt.device))
        tgt_mask = tgt_mask.unsqueeze(0).unsqueeze(0)

        enc = self.transformer.encode(src, src_mask)
        dec = self.transformer.decode(enc, src_mask, tgt, tgt_mask)
        return self.transformer.project(dec)


model.load_state_dict(checkpoint["model_state_dict"])
wrapped_model = TransformerWrapper(model)
wrapped_model.eval()

src = torch.randint(0, vocab_size, (1, src_seq_len), dtype=torch.long)
tgt = torch.full((1, 1), 1, dtype=torch.long)

torch.onnx.export(
    wrapped_model,
    (src, tgt),
    "myapp/static/model.onnx",
    opset_version=18,
    input_names=["src", "tgt"],
    output_names=["logits"],
    dynamic_axes={
        "src": {0: "batch", 1: "src_seq"},
        "tgt": {0: "batch", 1: "tgt_seq"},
        "logits": {0: "batch", 1: "tgt_seq"}
    },
    do_constant_folding=True,
    dynamo=False
)

onnx_model = onnx.load("myapp/static/model.onnx")
onnx.checker.check_model(onnx_model)

session = ort.InferenceSession("myapp/static/model.onnx")
outputs = session.run(
    None,
    {
        "src": src.numpy(),
        "tgt": tgt.numpy()
    }
)

print([o.shape for o in outputs])