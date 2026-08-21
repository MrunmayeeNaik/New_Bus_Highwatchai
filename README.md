# New Bus - Intercity Bus Booking Platform

New Bus is a production-ready, enterprise-grade intercity bus booking marketplace modeled after RedBus. It connects passengers, operators, and platform administrators through a sleek, responsive design and robust service-oriented architecture.

---

## 🚀 Tech Stack

### Backend
*   **Python 3.12+** / **FastAPI**: Fast, asynchronous REST API.
*   **SQLAlchemy ORM**: Database object mapping.
*   **PostgreSQL**: High-concurrency transaction storage.
*   **JWT & bcrypt**: Secure password hashing and token rotation.
*   **Pytest**: Automated test suite execution.

### Frontend
*   **React** / **Vite**: Fast, single-page application bundling.
*   **Tailwind CSS**: Modern aesthetics with glassmorphic cards and dark-mode tokens.
*   **Axios**: Network request adapter with auto JWT attachment.
*   **Lucide React**: Clean vector icon toolkit.

---

## 📁 Project Folder Layout

```text
Neo_bus/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py            # Entry point & CORS/routing config
│   │   ├── core/              # DB configs, secrets, passlib
│   │   ├── models/            # SQLAlchemy database tables
│   │   ├── schemas/           # Pydantic validation models
│   │   ├── repositories/      # SOLID database queries CRUD
│   │   ├── services/          # Concurrency holds, fares, refunds
│   │   └── routers/           # Auth, bookings, support, operator, admin
│   └── tests/                 # Isolated pytest suite
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js     # Branding rose-500 styling
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.jsx           # React app mount
│   │   ├── App.jsx            # Routing and layouts
│   │   ├── index.css          # Base Tailwind and glassmorphism styles
│   │   ├── services/          # api.js Client & Fallback mock engine
│   │   ├── store/             # authStore global hooks
│   │   ├── components/        # Layout elements (Header, Footer)
│   │   └── pages/             # Landing, Search, Checkout, Confirmations, Dashboards
└── docker-compose.yml         # DevOps multi-container build
```

---

## 🛠️ Local Development Setup

### 1. Backend Server Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Run the FastAPI development server:
    ```bash
    uvicorn app.main:app --reload
    ```
4.  Open API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend React Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd ../frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Launch the Vite hot-reloading dev server:
    ```bash
    npm run dev
    ```
4.  Open the web application: [http://localhost:5173](http://localhost:5173)

---

## 🐳 Docker Deployment (Production Compose)

To spin up the PostgreSQL database and the backend API container in one command:
```bash
docker-compose up --build
```
This automatically maps port `5432` for Postgres and `8000` for FastAPI.

---

## 💡 Seeding Demo Data

To populate the search engine with states, cities (Mumbai, Bangalore, Hyderabad), routes, operators, and trips:
1.  Log into the app as **Admin** by entering:
    *   **Email**: `admin@newbus.com`
    *   **Password**: *any password (mock login fallback)*
2.  Click **Seed Master Data** in the top-right of the Admin Dashboard.
3.  Your database will instantly fill with schedules and seat maps.

---

## 🔒 Production Checklist
*   [ ] Change default `JWT_SECRET_KEY` in env variables.
*   [ ] Bind uvicorn to behind an Nginx reverse proxy.
*   [ ] Force SSL/HTTPS encryption on Nginx.
*   [ ] Turn off `SEED_DEMO_DATA` in config.py.
