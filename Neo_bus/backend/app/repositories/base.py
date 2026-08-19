from typing import Generic, TypeVar, Type, List, Optional, Any, Dict, Union
from sqlalchemy.orm import Session
from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        # Handle soft deletes by default if column exists
        import uuid
        if isinstance(id, str):
            try:
                id = uuid.UUID(id)
            except ValueError:
                pass
        query = db.query(self.model).filter(self.model.id == id)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at.is_(None))
        return query.first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        query = db.query(self.model)
        if hasattr(self.model, "deleted_at"):
            query = query.filter(self.model.deleted_at.is_(None))
        return query.offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: Dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: ModelType, obj_in: Union[Dict[str, Any], Any]
    ) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
            
        for field in update_data:
            if hasattr(db_obj, field):
                setattr(db_obj, field, update_data[field])
                
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any, soft: bool = True) -> Optional[ModelType]:
        import uuid
        if isinstance(id, str):
            try:
                id = uuid.UUID(id)
            except ValueError:
                pass
        obj = db.query(self.model).get(id)
        if not obj:
            return None
            
        if soft and hasattr(obj, "deleted_at"):
            import datetime
            obj.deleted_at = datetime.datetime.now(datetime.timezone.utc)
            db.add(obj)
        else:
            db.delete(obj)
            
        db.commit()
        return obj
