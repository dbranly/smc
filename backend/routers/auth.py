from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models,  schemas
from auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
def login(form: schemas.LoginForm, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.email).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = models.User(nom=data.nom, email=data.email, hashed_password=hash_password(data.password), role=data.role)
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user