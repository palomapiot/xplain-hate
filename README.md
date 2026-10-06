# Xplain Hate 🔍

Xplain Hate is a browser extension for X (formerly Twitter) that detects hate speech in tweets and explains why a message is hateful. It adds an analyze button to every tweet. When you click it, the tweet is analyzed by the [`Llama-3-8B-Distil-MetaHate`](https://huggingface.co/irlab-udc/Llama-3-8B-Distil-MetaHate) model running on an [Ollama](https://ollama.com) server, and the hateful phrases are highlighted in the tweet, each with a hover explanation.

```
┌────────────────┐  message   ┌───────────────────┐  HTTP /api/chat  ┌──────────────────────────┐
│ x.com (tweet)  │ ─────────► │ extension service │ ───────────────► │ Ollama server            │
│ content.js     │ ◄───────── │ worker            │ ◄─────────────── │ model: xplain-hate       │
└────────────────┘  highlights└───────────────────┘   JSON answer    │ (Llama 3 8B + LoRA)      │
                                                                     └──────────────────────────┘
```

The project has two parts that you set up separately:

| Part | Where | What it does |
|------|-------|--------------|
| **Extension** | this repo | Chrome extension (Manifest V3) that adds the analyze button and renders highlights and explanations on `x.com`. |
| **Model server** | this repo (`ollama/`, `docker-compose.yml`) | Ollama running the distilled hate speech model. |

---

## Prerequisites 📋

- A Chromium-based browser (Chrome, Edge, Brave...)
- [Ollama](https://ollama.com/download), **or** Docker with the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) if you prefer running it in a container
- About 6 GB of free memory (GPU VRAM or RAM) and about 6 GB of disk for the model. A GPU is strongly recommended; on CPU each analysis can take a long time.
- `curl` (used by the setup script to download the adapter)

---

## Step 1: Run the model with Ollama 🚀

The model on Hugging Face is a LoRA **adapter** on top of Llama 3 8B Instruct. The `ollama/Modelfile` in this repo combines both, and `ollama/setup.sh` downloads the adapter and creates a model called `xplain-hate`.

Clone this repository first:

```bash
git clone https://github.com/palomapiot/xplain-hate.git
cd xplain-hate
```

### Option A: Ollama installed on the machine

1. Install Ollama from [ollama.com/download](https://ollama.com/download).
2. Start the server allowing the browser extension to connect (needed, otherwise Ollama answers `403`):

   ```bash
   OLLAMA_ORIGINS="chrome-extension://*" ollama serve
   ```

   If the server runs on another machine and you want to reach it over the network, also add `OLLAMA_HOST=0.0.0.0`. For the macOS app or a systemd service, set these variables in the app/service environment instead (see the [Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-configure-ollama-server)).
3. In another terminal, create the model:

   ```bash
   ./ollama/setup.sh
   ```

### Option B: Ollama in Docker (NVIDIA GPU)

```bash
docker compose up -d
./ollama/setup.sh --docker
```

`docker-compose.yml` already exposes port `11434` and sets `OLLAMA_ORIGINS`.

### Check that it works

```bash
ollama run xplain-hate
```

or, against the HTTP API:

```bash
curl http://localhost:11434/api/tags
```

The list should contain `xplain-hate`.

---

## Step 2: Configure the extension ⚙️

The address of the Ollama server is kept in a local `.env` file that is **not** committed to git, so your own IP never ends up in the repository.

```bash
cp .env.example .env      # then edit .env
./scripts/generate-config.sh
```

`.env`:

```bash
# Use http://localhost:11434 if Ollama runs on the same machine as your browser,
# or the IP/hostname of your server (e.g. http://192.168.1.50:11434).
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=xplain-hate
```

Chrome extensions cannot read `.env` files directly, so `generate-config.sh` converts it into `scripts/config.js` (also git-ignored). **Run it again whenever you change `.env`**, then reload the extension.

---

## Step 3: Install the extension in Chrome 🧩

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the root folder of this repository (the one containing `manifest.json`).
4. Open [https://x.com](https://x.com). The Xplain Hate button appears next to the actions of each tweet.

---

## Usage

1. Browse X as usual.
2. Click the Xplain Hate button on a tweet to analyse it.
3. If the tweet is hateful, it is flagged and the offending phrases are highlighted. Hover over them to read the explanation.
4. If it is not hateful, the tweet is marked as hate-free.

---

## Development 🛠️

1. Make your changes to the source.
2. Click the reload button on the extension card in `chrome://extensions`, then refresh the X tab.
3. To see errors from the service worker, click **service worker** on the extension card to open its DevTools console.

```
xplain-hate/
├── manifest.json            # Extension manifest (Manifest V3)
├── credit.html              # Popup shown when clicking the extension icon
├── scripts/
│   ├── content.js           # Injects the button and highlights text on x.com
│   ├── background.js        # Service worker: calls Ollama and parses the answer
│   └── generate-config.sh   # Builds scripts/config.js from .env
├── styles/                  # CSS for buttons, highlights and popups
├── images/                  # Button icons
├── ollama/
│   ├── Modelfile            # Llama 3 8B Instruct + Distil-MetaHate adapter
│   └── setup.sh             # Downloads the adapter and creates the model
├── docker-compose.yml       # Ollama in Docker (NVIDIA GPU)
└── .env.example             # Template for your local .env
```

---

## Troubleshooting

- **Nothing happens when clicking the button**: open the service worker console (see Development) and check for errors. Confirm that `OLLAMA_URL` in `.env` is reachable from your browser and that you ran `./scripts/generate-config.sh`.
- **`403` from Ollama**: start Ollama with `OLLAMA_ORIGINS="chrome-extension://*"`.
- **`404` from Ollama**: the `xplain-hate` model has not been created. Run `./ollama/setup.sh`.
- **Connection refused from another machine**: Ollama listens on `localhost` only by default. Start it with `OLLAMA_HOST=0.0.0.0` (or use Docker, which publishes the port) and check your firewall.
- **Answers are not valid or look degraded**: the adapter was trained on a 4-bit Llama 3 base. In `ollama/Modelfile`, try `FROM llama3:8b-instruct-q8_0` (or `-fp16`) and run `./ollama/setup.sh` again.
- **Container can't see the GPU**: verify that `nvidia-smi` works on the host and that the NVIDIA Container Toolkit is installed.

---

## Citation 📑

If you use this extension or the model in your work, please cite:

```bibtex
@InProceedings{10.1007/978-3-031-88711-6_24,
    author="Piot, Paloma
    and Parapar, Javier",
    title="Towards Efficient and Explainable Hate Speech Detection via Model Distillation",
    booktitle="Advances in Information Retrieval",
    year="2025",
    publisher="Springer Nature Switzerland",
    address="Cham",
    pages="376--392",
    isbn="978-3-031-88711-6"
}
```

---

## Disclaimer ⚠️

This project processes and displays content that may contain hate speech, offensive language, or other objectionable material. Detection and explanations are generated by a language model and may be wrong; they should not be used as the sole basis for moderation decisions. The project is intended for research, analysis, and educational purposes only.

---

## License

The model is built on Meta Llama 3 and is subject to the [Llama 3 Community License](https://llama.meta.com/llama3/license/).

---

## Acknowledgements 🙏

Developed by [IRLab](https://www.irlab.org) (University of A Coruña). The authors thank Diego Sánchez Lamas for his contribution to developing the extension. Funded by the Horizon Europe research and innovation programme under the Marie Skłodowska-Curie Grant Agreement No. 101073351, and by the CITIC Research Center and the project PID2022-137061OB-C21 (Ministerio de Ciencia e Innovación, ERDF).

---

## Contact 📬

Questions or issues? Write to [paloma.piot@udc.es](mailto:paloma.piot@udc.es) or open an [issue on GitHub](https://github.com/palomapiot/xplain-hate/issues).
