using System;
using MediaBrowser.Common.Plugins;

namespace Jellyfin.Plugin.QuickSwitch;

/// <summary>
/// The Quick Switch plugin entry point. It has no settings and stores nothing on
/// the server: saved accounts live on each device.
/// </summary>
public class Plugin : BasePlugin
{
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
