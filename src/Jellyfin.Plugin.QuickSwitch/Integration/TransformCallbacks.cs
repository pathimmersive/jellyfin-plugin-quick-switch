namespace Jellyfin.Plugin.QuickSwitch.Integration;

/// <summary>
/// The file being served, as File Transformation passes it to a callback.
/// </summary>
public class TransformInput
{
    /// <summary>
    /// Gets or sets the file's current contents.
    /// </summary>
    public string? Contents { get; set; }
}

/// <summary>
/// The methods File Transformation calls by name when it serves a registered file.
/// Returning null leaves the file as it was.
/// </summary>
public static class TransformCallbacks
{
    /// <summary>
    /// Patches index.html.
    /// </summary>
    /// <param name="input">The served file.</param>
    /// <returns>The patched page, or null.</returns>
    public static string? Index(TransformInput input) =>
        input.Contents is { } html ? WebPatches.PatchIndex(html) : null;
}
