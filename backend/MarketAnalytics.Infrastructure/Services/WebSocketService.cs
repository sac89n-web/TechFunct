using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace MarketAnalytics.Infrastructure.Services;

public class WebSocketService : IWebSocketService
{
    private readonly ILogger<WebSocketService> _logger;
    private ClientWebSocket? _webSocket;
    private CancellationTokenSource? _cancellationTokenSource;
    
    public event EventHandler<KiteTickDto>? OnTickReceived;

    public WebSocketService(ILogger<WebSocketService> logger)
    {
        _logger = logger;
    }

    public async Task ConnectAsync(string accessToken)
    {
        _webSocket = new ClientWebSocket();
        _cancellationTokenSource = new CancellationTokenSource();

        var uri = new Uri($"wss://ws.kite.trade?api_key={accessToken}");
        await _webSocket.ConnectAsync(uri, _cancellationTokenSource.Token);
        
        _logger.LogInformation("WebSocket connected");
        
        _ = Task.Run(() => ReceiveLoop(_cancellationTokenSource.Token));
    }

    public async Task SubscribeAsync(List<long> instrumentTokens)
    {
        if (_webSocket?.State != WebSocketState.Open)
        {
            _logger.LogWarning("WebSocket not connected");
            return;
        }

        var subscribeMessage = new
        {
            a = "subscribe",
            v = instrumentTokens
        };

        var json = JsonConvert.SerializeObject(subscribeMessage);
        var bytes = Encoding.UTF8.GetBytes(json);
        
        await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        
        var modeMessage = new
        {
            a = "mode",
            v = new object[] { "full", instrumentTokens }
        };

        json = JsonConvert.SerializeObject(modeMessage);
        bytes = Encoding.UTF8.GetBytes(json);
        
        await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        
        _logger.LogInformation("Subscribed to {Count} instruments", instrumentTokens.Count);
    }

    public async Task DisconnectAsync()
    {
        if (_webSocket != null)
        {
            _cancellationTokenSource?.Cancel();
            await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            _webSocket.Dispose();
            _logger.LogInformation("WebSocket disconnected");
        }
    }

    private async Task ReceiveLoop(CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        
        while (_webSocket?.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, cancellationToken);
                    break;
                }

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                ProcessMessage(message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in WebSocket receive loop");
            }
        }
    }

    private void ProcessMessage(string message)
    {
        try
        {
            var ticks = JsonConvert.DeserializeObject<List<dynamic>>(message);
            if (ticks == null) return;

            foreach (var tick in ticks)
            {
                var tickDto = new KiteTickDto
                {
                    InstrumentToken = tick.instrument_token,
                    LastPrice = tick.last_price,
                    Volume = tick.volume ?? 0,
                    High = tick.ohlc?.high ?? 0,
                    Low = tick.ohlc?.low ?? 0,
                    Open = tick.ohlc?.open ?? 0,
                    Change = tick.change ?? 0
                };

                OnTickReceived?.Invoke(this, tickDto);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing WebSocket message");
        }
    }
}
