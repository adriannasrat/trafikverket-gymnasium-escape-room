FROM node:22-alpine AS web-build
WORKDIR /src/apps/web

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS api-build
WORKDIR /src

COPY global.json Directory.Build.props EscapeRoom.sln ./
COPY apps/api/EscapeRoom.Api.csproj apps/api/
RUN dotnet restore apps/api/EscapeRoom.Api.csproj

COPY apps/api/ apps/api/
RUN dotnet publish apps/api/EscapeRoom.Api.csproj --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache krb5-libs \
    && addgroup -S escape-room && adduser -S escape-room -G escape-room \
    && mkdir -p /app/uploads /app/data-protection-keys \
    && chown -R escape-room:escape-room /app
USER escape-room
COPY --from=api-build --chown=escape-room:escape-room /app/publish .
COPY --from=web-build --chown=escape-room:escape-room /src/apps/web/dist ./wwwroot
EXPOSE 8080
ENTRYPOINT ["dotnet", "EscapeRoom.Api.dll"]
