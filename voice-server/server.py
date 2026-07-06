import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model on startup
model_size = "tiny"
print(f"Carregando modelo Whisper '{model_size}'...")
model = WhisperModel(model_size, device="cpu", compute_type="int8")
print("Modelo carregado com sucesso!")

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        shutil.copyfileobj(audio.file, temp_audio)
        temp_file_path = temp_audio.name
        
    try:
        segments, info = model.transcribe(temp_file_path, beam_size=5, language="pt")
        text = " ".join([segment.text for segment in segments])
        return {"text": text.strip(), "language": info.language}
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
