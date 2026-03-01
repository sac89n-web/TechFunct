using System;
using System.Threading.Tasks;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace MarketAnalytics.API.Hubs;

/// <summary>
/// SignalR hub for real-time option chain updates.
/// Clients subscribe to an index+expiry group; the server pushes refreshed
/// chain data every ~30 seconds via the background service.
/// </summary>
public class OptionsHub : Hub
{
    private readonly IOptionsChainService _chainService;
    private readonly ILogger<OptionsHub>  _logger;

    public OptionsHub(IOptionsChainService chainService, ILogger<OptionsHub> logger)
    {
        _chainService = chainService;
        _logger       = logger;
    }

    // Client → Hub: join a group for live updates
    public async Task SubscribeToOptionChain(string indexName, string expiry)
    {
        var groupName = GroupKey(indexName, expiry);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogDebug("Client {ConnId} subscribed to {Group}", Context.ConnectionId, groupName);
    }

    // Client → Hub: leave the group
    public async Task UnsubscribeFromOptionChain(string indexName, string expiry)
    {
        var groupName = GroupKey(indexName, expiry);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogDebug("Client {ConnId} unsubscribed from {Group}", Context.ConnectionId, groupName);
    }

    // Client → Hub: request an immediate chain refresh (server responds via group push)
    public async Task RequestChainRefresh(string indexName, string expiry)
    {
        if (!DateOnly.TryParse(expiry, out var expiryDate))
        {
            await Clients.Caller.SendAsync("ChainError", $"Invalid expiry date: {expiry}");
            return;
        }

        try
        {
            var chain = await _chainService.GetOptionChainAsync(indexName, expiryDate);
            var group = GroupKey(indexName, expiry);
            await Clients.Group(group).SendAsync("ChainUpdated", chain);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RequestChainRefresh failed for {Index} {Expiry}", indexName, expiry);
            await Clients.Caller.SendAsync("ChainError", ex.Message);
        }
    }

    private static string GroupKey(string indexName, string expiry) =>
        $"options:{indexName}:{expiry}";
}
