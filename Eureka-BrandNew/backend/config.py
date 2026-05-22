from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url:       str = "postgresql://eureka:eureka@localhost:5432/eureka"
    openrouter_api_key: str = ""
    openai_api_key:     str = ""   # Used for Whisper ASR on audio flash upload
    user_id:            str = "default"
    backend_url:        str = "http://localhost:8000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
