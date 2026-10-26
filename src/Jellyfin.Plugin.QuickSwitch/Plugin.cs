using System;
using Jellyfin.Plugin.QuickSwitch.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.QuickSwitch;

/// <summary>
/// The Quick Switch plugin entry point. It has no settings and stores nothing on
/// the server: saved accounts live on each device.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">The server's application paths.</param>
    /// <param name="xmlSerializer">The server's XML serializer.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
    }

    /// <summary>
    /// The plugin id, also written to meta.json by the build.
    /// </summary>
    public const string PluginId = "80f9de45-eed8-4c2b-97bd-25de685527d1";

    /// <inheritdoc />
    public override string Name => "Quick Switch";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse(PluginId);

    /// <inheritdoc />
    public override string Description => "Switch between the Jellyfin accounts saved on a shared device without signing out.";
}
