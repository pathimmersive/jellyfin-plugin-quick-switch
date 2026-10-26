using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.QuickSwitch.Integration;

/// <summary>
/// Registers the index.html patch with File Transformation while the server runs.
/// </summary>
public sealed class WebIntegrationService : IHostedService
{
    /// <summary>
    /// The registration id of the index.html patch.
    /// </summary>
    public static readonly Guid IndexTransformationId = new("061c6a87-8fca-44f4-8660-9949e7859b22");

    private readonly FileTransformationBridge _bridge;
    private readonly ILogger<WebIntegrationService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="WebIntegrationService"/> class.
    /// </summary>
    /// <param name="bridge">The File Transformation bridge.</param>
    /// <param name="logger">The logger.</param>
    public WebIntegrationService(FileTransformationBridge bridge, ILogger<WebIntegrationService> logger)
    {
        _bridge = bridge;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_bridge.IsAvailable)
        {
            _logger.LogWarning("File Transformation 3.x is not installed, so the account switcher is not added to jellyfin-web.");
            return Task.CompletedTask;
        }

        try
        {
            if (_bridge.Register(IndexTransformationId, "^index\\.html$", nameof(TransformCallbacks.Index)))
            {
                _logger.LogInformation("Account switcher added to jellyfin-web");
            }
            else
            {
                _logger.LogWarning("File Transformation is loaded but did not accept the registration; jellyfin-web is unchanged.");
            }
        }
        catch (Exception exception)
        {
            // A File Transformation change can only break the switcher, never the server.
            _logger.LogError(exception, "Registering the account switcher with File Transformation failed");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            _bridge.Remove(IndexTransformationId);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Removing the account switcher from File Transformation failed");
        }

        return Task.CompletedTask;
    }
}
