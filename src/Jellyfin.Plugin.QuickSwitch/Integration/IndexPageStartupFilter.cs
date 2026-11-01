using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.QuickSwitch.Integration;

/// <summary>
/// Puts <see cref="IndexPageMiddleware"/> ahead of the rest of Jellyfin's pipeline,
/// so it sees jellyfin-web's index page before it is sent.
/// </summary>
public sealed class IndexPageStartupFilter : IStartupFilter
{
    private readonly ILogger<IndexPageStartupFilter> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="IndexPageStartupFilter"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    public IndexPageStartupFilter(ILogger<IndexPageStartupFilter> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        _logger.LogInformation("Account switcher added to jellyfin-web");
        app.UseMiddleware<IndexPageMiddleware>();
        next(app);
    };
}
