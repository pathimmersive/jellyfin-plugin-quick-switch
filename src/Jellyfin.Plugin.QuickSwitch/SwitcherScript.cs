using System;
using System.IO;
using System.Security.Cryptography;

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

    private static readonly Lazy<string> _etag = new(ComputeETag);

    /// <summary>
    /// Gets the plugin version, which the script tag carries so an upgrade changes the script's URL.
    /// </summary>
    public static string Version { get; } = typeof(SwitcherScript).Assembly.GetName().Version?.ToString() ?? "0";

    /// <summary>
    /// Gets the entity tag of the embedded script: a quoted prefix of its SHA-256.
    /// </summary>
    public string ETag => _etag.Value;

    /// <summary>
    /// Opens the script.
    /// </summary>
    /// <returns>The script content.</returns>
    public Stream Open() =>
        typeof(SwitcherScript).Assembly.GetManifestResourceStream(FileName)
        ?? throw new FileNotFoundException("The switcher script is not embedded in the plugin assembly.", FileName);

    private static string ComputeETag()
    {
        using var stream = new SwitcherScript().Open();
        var hash = Convert.ToHexStringLower(SHA256.HashData(stream));
        return "\"" + hash[..16] + "\"";
    }
}
