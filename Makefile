.PHONY: help install dev test lint format clean build docker-build docker-run helm-install helm-upgrade

help:
	@echo "Available commands:"
	@echo "  make install          - Install dependencies"
	@echo "  make dev              - Start development server"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Run linter"
	@echo "  make format           - Format code"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make build            - Build for production"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container"
	@echo "  make helm-install     - Install Helm chart"
	@echo "  make helm-upgrade     - Upgrade Helm chart"

install:
	npm install

dev:
	npm run dev

test:
	npm test

lint:
	npm run lint

format:
	npm run format

clean:
	npm run clean

build:
	npm run build

docker-build:
	docker build -t k8s-guardian:latest .

docker-run:
	docker run -p 8080:8080 -p 9090:9090 k8s-guardian:latest

helm-install:
	helm install k8s-guardian ./helm/k8s-guardian --namespace k8s-guardian --create-namespace

helm-upgrade:
	helm upgrade k8s-guardian ./helm/k8s-guardian --namespace k8s-guardian

docker-compose-up:
	docker-compose up -d

docker-compose-down:
	docker-compose down

audit:
	npm run audit

prepare:
	npm run prepare
