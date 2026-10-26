using System.IO;

namespace Jellyfin.Plugin.QuickSwitch;

/// <summary>
/// The switcher script, embedded in the plugin assembly.
/// </summary>
public class SwitcherScript
{
    /// <summary>
    /// The script's file name, under the plugin route.
    /// </summary>
    public const string FileName = "quick-switch.js";

    /// <summary>
    /// The script's content type.
    /// </summary>
    public const string ContentType = "text/javascript; charset=utf-8";

    /// <summary>
    /// Opens the script.
    /// </summary>
    /// <returns>The script content.</returns>
    public Stream Open() =>
        typeof(SwitcherScript).Assembly.GetManifestResourceStream(FileName)
        ?? throw new FileNotFoundException("The switcher script is not embedded in the plugin assembly.", FileName);
}
