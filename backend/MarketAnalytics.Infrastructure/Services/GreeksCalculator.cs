using System;
using MarketAnalytics.Core.Interfaces;

namespace MarketAnalytics.Infrastructure.Services;

/// <summary>
/// Black-Scholes Greeks calculator with Newton-Raphson implied volatility solver.
/// All calculations are server-side. No market data is approximated or invented.
/// </summary>
public class GreeksCalculator : IGreeksCalculator
{
    // Standard normal CDF — Abramowitz & Stegun approximation (max error 7.5e-8)
    private static double N(double x)
    {
        if (x < -10) return 0.0;
        if (x >  10) return 1.0;

        const double a1 =  0.319381530;
        const double a2 = -0.356563782;
        const double a3 =  1.781477937;
        const double a4 = -1.821255978;
        const double a5 =  1.330274429;
        const double p  =  0.2316419;

        double k    = 1.0 / (1.0 + p * Math.Abs(x));
        double poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))));
        double val  = 1.0 - Npdf(x) * poly;
        return x >= 0 ? val : 1.0 - val;
    }

    // Standard normal PDF
    private static double Npdf(double x)
        => Math.Exp(-0.5 * x * x) / Math.Sqrt(2.0 * Math.PI);

    private static (double d1, double d2) D1D2(
        double S, double K, double T, double r, double sigma)
    {
        double d1 = (Math.Log(S / K) + (r + 0.5 * sigma * sigma) * T)
                  / (sigma * Math.Sqrt(T));
        double d2 = d1 - sigma * Math.Sqrt(T);
        return (d1, d2);
    }

    public double CallPrice(double S, double K, double T, double r, double sigma)
    {
        if (T <= 0) return Math.Max(S - K, 0.0);
        var (d1, d2) = D1D2(S, K, T, r, sigma);
        return S * N(d1) - K * Math.Exp(-r * T) * N(d2);
    }

    public double PutPrice(double S, double K, double T, double r, double sigma)
    {
        if (T <= 0) return Math.Max(K - S, 0.0);
        var (d1, d2) = D1D2(S, K, T, r, sigma);
        return K * Math.Exp(-r * T) * N(-d2) - S * N(-d1);
    }

    public double Delta(double S, double K, double T, double r, double sigma, bool isCall)
    {
        if (T <= 0)
            return isCall ? (S > K ? 1.0 : 0.0) : (S < K ? -1.0 : 0.0);
        var (d1, _) = D1D2(S, K, T, r, sigma);
        return isCall ? N(d1) : N(d1) - 1.0;
    }

    public double Gamma(double S, double K, double T, double r, double sigma)
    {
        if (T <= 0 || S <= 0 || sigma <= 0) return 0.0;
        var (d1, _) = D1D2(S, K, T, r, sigma);
        return Npdf(d1) / (S * sigma * Math.Sqrt(T));
    }

    public double Theta(double S, double K, double T, double r, double sigma, bool isCall)
    {
        if (T <= 0) return 0.0;
        var (d1, d2) = D1D2(S, K, T, r, sigma);
        double term1 = -(S * Npdf(d1) * sigma) / (2.0 * Math.Sqrt(T));
        double theta = isCall
            ? term1 - r * K * Math.Exp(-r * T) * N(d2)
            : term1 + r * K * Math.Exp(-r * T) * N(-d2);
        return theta / 365.0; // per calendar day
    }

    public double Vega(double S, double K, double T, double r, double sigma)
    {
        if (T <= 0) return 0.0;
        var (d1, _) = D1D2(S, K, T, r, sigma);
        return S * Npdf(d1) * Math.Sqrt(T) / 100.0; // per 1% IV change
    }

    /// <summary>
    /// Newton-Raphson IV solver. Returns null if market price is invalid or no convergence.
    /// Never approximates or invents IV.
    /// </summary>
    public double? ImpliedVolatility(
        double marketPrice, double S, double K, double T, double r, bool isCall)
    {
        if (T <= 0 || marketPrice <= 0 || S <= 0 || K <= 0)
            return null;

        // Intrinsic value check — option cannot be cheaper than intrinsic
        double intrinsic = isCall ? Math.Max(S - K, 0) : Math.Max(K - S, 0);
        if (marketPrice < intrinsic - 0.01)
            return null;

        // Brenner-Subrahmanyam initial guess
        double sigma = Math.Sqrt(2.0 * Math.PI / T) * (marketPrice / S);
        sigma = Math.Clamp(sigma, 0.01, 5.0);

        const int    maxIter = 150;
        const double tol     = 1e-6;

        for (int i = 0; i < maxIter; i++)
        {
            double price   = isCall ? CallPrice(S, K, T, r, sigma)
                                    : PutPrice(S, K, T, r, sigma);
            double vegaVal = Vega(S, K, T, r, sigma) * 100.0; // un-scale

            double diff = price - marketPrice;
            if (Math.Abs(diff) < tol) return sigma;
            if (Math.Abs(vegaVal) < 1e-12) return null; // vega ≈ 0, cannot iterate

            sigma -= diff / vegaVal;
            sigma  = Math.Clamp(sigma, 0.001, 5.0);
        }

        return null; // did not converge
    }
}
