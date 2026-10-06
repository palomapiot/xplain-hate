#!/usr/bin/env sh
# Downloads the Llama-3-8B-Distil-MetaHate LoRA adapter and creates the
# `xplain-hate` model in Ollama.
#
#   ./ollama/setup.sh            # uses the local `ollama` CLI
#   ./ollama/setup.sh --docker   # uses the container from docker-compose.yml
set -eu
cd "$(dirname "$0")"

MODEL_NAME="${OLLAMA_MODEL:-xplain-hate}"
REPO="https://huggingface.co/irlab-udc/Llama-3-8B-Distil-MetaHate/resolve/main"

mkdir -p adapter
for f in adapter_config.json adapter_model.safetensors; do
  if [ ! -s "adapter/$f" ]; then
    echo "Downloading $f ..."
    curl -fL --progress-bar -o "adapter/$f" "$REPO/$f"
  fi
done

if [ "${1:-}" = "--docker" ]; then
  # ./ollama is mounted at /models inside the container
  docker compose -f ../docker-compose.yml exec ollama ollama pull llama3:8b
  docker compose -f ../docker-compose.yml exec ollama ollama create "$MODEL_NAME" -f /models/Modelfile
else
  ollama pull llama3:8b
  ollama create "$MODEL_NAME" -f Modelfile
fi

echo "Done. Test it with:  ollama run $MODEL_NAME"
