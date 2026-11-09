from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="6Native Tailor API",
    description="Catalog and service API for the 6Native Tailor storefront.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class CatalogItem(BaseModel):
    id: str
    name: str
    category: str
    price: int
    currency: str = "NGN"


CATALOG = [
    CatalogItem(id="season-dress", name="All-Season Ankara Dress", category="New arrivals", price=98500),
    CatalogItem(id="green-palm-coord", name="Green Palm Co-ord", category="Ready to wear", price=112000),
    CatalogItem(id="purple-agbada", name="Purple Agbada Set", category="Ready to wear", price=42000),
    CatalogItem(id="green-mens-kaftan", name="Green Men's Kaftan", category="Ready to wear", price=76000),
]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/products", response_model=list[CatalogItem])
def list_products() -> list[CatalogItem]:
    return CATALOG
