FROM golang:1.22-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM gcr.io/distroless/static:nonroot

COPY --from=build /server /server

USER nonroot:nonroot
EXPOSE 50051 8080
ENTRYPOINT ["/server"]
