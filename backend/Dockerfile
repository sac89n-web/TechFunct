# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /build

# Copy project files
COPY . .

# Restore and publish
WORKDIR /build/MarketAnalytics.API
RUN dotnet restore
RUN dotnet publish -c Release -o /app/out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy published app
COPY --from=build /app/out .

# Expose port (Render sets PORT env var)
EXPOSE 5000

# Run the app
CMD ["dotnet", "MarketAnalytics.API.dll"]
