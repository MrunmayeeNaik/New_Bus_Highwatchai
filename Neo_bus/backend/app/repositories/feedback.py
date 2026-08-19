from typing import List
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.feedback import Review, Notification

class ReviewRepository(BaseRepository[Review]):
    def get_by_trip(self, db: Session, trip_id: str) -> List[Review]:
        return db.query(self.model).filter(Review.trip_id == trip_id, Review.is_moderated == False).all()

    def get_by_operator(self, db: Session, operator_id: str) -> List[Review]:
        return db.query(self.model).filter(Review.operator_id == operator_id, Review.is_moderated == False).all()

class NotificationRepository(BaseRepository[Notification]):
    def get_unread_for_user(self, db: Session, user_id: str) -> List[Notification]:
        return db.query(self.model).filter(
            Notification.user_id == user_id,
            Notification.status == "pending"
        ).all()

review_repo = ReviewRepository(Review)
notification_repo = NotificationRepository(Notification)
