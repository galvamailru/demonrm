from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://nrm:nrm@postgres:5432/nrm"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"


settings = Settings()
