FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY global.json Directory.Build.props EscapeRoom.sln ./
COPY apps/api/EscapeRoom.Api.csproj apps/api/
RUN dotnet restore apps/api/EscapeRoom.Api.csproj

COPY apps/api/ apps/api/
RUN dotnet publish apps/api/EscapeRoom.Api.csproj --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN addgroup -S escape-room && adduser -S escape-room -G escape-room \
    && mkdir -p /app/uploads \
    && chown -R escape-room:escape-room /app
USER escape-room
COPY --from=build --chown=escape-room:escape-room /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EscapeRoom.Api.dll"]
