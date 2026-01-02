from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Union, Optional


class Settings(BaseSettings):

    MONGO_URI: str = Field(default="mongodb://localhost:27017")
    MONGO_DB: str = Field(default="obvioustrades")

    POLYGON_API_KEY: Optional[str] = None

    JWT_SECRET: str = Field(default="dev-change-me")
    JWT_ALG: str = Field(default="HS256")

    ACCESS_TOKEN_TTL_MIN: int = Field(default=60)
    REFRESH_TOKEN_TTL_DAYS: int = Field(default=14)

    ACCESS_COOKIE_NAME: str = Field(default="access_token")
    REFRESH_COOKIE_NAME: str = Field(default="refresh_token")

    COOKIE_SECURE: bool = Field(default=False)
    COOKIE_SAMESITE: str = Field(default="lax")
    COOKIE_DOMAIN: Optional[str] = None

    BCRYPT_ROUNDS: int = Field(default=12)

    CORS_ORIGINS: Union[List[str], str] = (
        "http://localhost:3000,http://127.0.0.1:3000"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]


settings = Settings()