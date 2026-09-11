# Python tests

These tests cover contract settlement rules and the hash-validated bootstrap
plan. Install the deploy group so bootstrap tests exercise the real CLI and SDK:

```bash
uv sync --locked --group dev --group deploy
uv run --locked --group deploy pytest -q
```

Bootstrap tests use temporary bundles and mock transaction clients; they do not
connect to a chain. Frontend tests remain under `src/` and run with `npm test`.

`test_native_checker.py` runs the shipped checker and reference collection through
`xian_vm_v1`, including invalid interface and metadata cases. CI runs this gate
with the sibling native extension built explicitly:

```bash
uv run --locked --group deploy --refresh-package xian-tech-vm-core \
  --with ../xian-contracting/packages/xian-vm-core \
  pytest -q tests/test_native_checker.py
```

The regular Python suite skips this module when the native extension is absent.
