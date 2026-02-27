using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace MarketAnalytics.API.Hubs;

public class MarketDataHub : Hub
{
    public async Task SubscribeToIndex(string indexName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, indexName);
    }

    public async Task UnsubscribeFromIndex(string indexName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, indexName);
    }
}
