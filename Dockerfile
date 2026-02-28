# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy all backend files
COPY backend/ ./

# Restore and publish from API project
WORKDIR /src/MarketAnalytics.API
RUN dotnet restore
RUN dotnet publish -c Release -o /app

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy published app
COPY --from=build /app .

# Expose port
EXPOSE 5000

# Run the app
CMD ["dotnet", "MarketAnalytics.API.dll"]
