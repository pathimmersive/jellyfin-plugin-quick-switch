using Jellyfin.Plugin.QuickSwitch.Integration;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.QuickSwitch;

/// <summary>
/// Registers the plugin's services with the host container.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<SwitcherScript>();
        serviceCollection.AddSingleton<FileTransformationBridge>();
        serviceCollection.AddHostedService<WebIntegrationService>();
    }
}
