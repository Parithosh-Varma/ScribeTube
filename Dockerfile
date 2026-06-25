FROM node:20-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend /app/dist ./dist
COPY server/ ./server/
EXPOSE 8080
CMD ["gunicorn", "server.server:app", "--bind", "0.0.0.0:8080"]
