using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using MarketAnalytics.Core.DTOs;
using MarketAnalytics.Core.Entities;
using MarketAnalytics.Core.Interfaces;

namespace MarketAnalytics.Infrastructure.Cache;

public class MarketDataCache : IMarketDataCache
{
    private readonly ConcurrentDictionary<string, MarketSnapshot> _snapshots = new();

    public void UpdateSnapshot(string symbol, KiteTickDto tick)
    {
        _snapshots.AddOrUpdate(symbol, 
            _ => new MarketSnapshot
            {
                Symbol = symbol,
                InstrumentToken = tick.InstrumentToken,
                LTP = tick.LastPrice,
                ChangePercent = tick.Change,
                Volume = tick.Volume,
                High = tick.High,
                Low = tick.Low,
                Open = tick.Open,
                LastUpdated = DateTime.UtcNow
            },
            (_, existing) =>
            {
                existing.LTP = tick.LastPrice;
                existing.ChangePercent = tick.Change;
                existing.Volume = tick.Volume;
                existing.High = tick.High;
                existing.Low = tick.Low;
                existing.Open = tick.Open;
                existing.LastUpdated = DateTime.UtcNow;
                return existing;
            });
    }

    public MarketSnapshot? GetSnapshot(string symbol)
    {
        _snapshots.TryGetValue(symbol, out var snapshot);
        return snapshot;
    }

    public Dictionary<string, MarketSnapshot> GetAllSnapshots()
    {
        return new Dictionary<string, MarketSnapshot>(_snapshots);
    }

    public void Clear()
    {
        _snapshots.Clear();
    }
}
