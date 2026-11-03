using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;

namespace Jellyfin.Plugin.QuickSwitch.Integration;

/// <summary>
/// Adds the switcher's script tag to jellyfin-web's index page as it is served.
/// Every other request passes through untouched; the file on disk is never written.
/// </summary>
public sealed partial class IndexPageMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IndexPageMiddleware> _logger;
    private readonly Func<string, string?> _change;
    private readonly Func<string?> _baseUrl;

    /// <summary>
    /// Initializes a new instance of the <see cref="IndexPageMiddleware"/> class.
    /// </summary>
    /// <param name="next">The rest of the pipeline.</param>
    /// <param name="logger">The logger.</param>
    /// <param name="configuration">The server configuration, for its BaseUrl.</param>
    public IndexPageMiddleware(RequestDelegate next, ILogger<IndexPageMiddleware> logger, IServerConfigurationManager configuration)
        : this(next, logger, WebPatches.PatchIndex, () => configuration.GetNetworkConfiguration().BaseUrl)
    {
    }

    // The change and the BaseUrl are parameters so the tests can set them.
    internal IndexPageMiddleware(RequestDelegate next, ILogger<IndexPageMiddleware> logger, Func<string, string?> change, Func<string?> baseUrl)
    {
        _next = next;
        _logger = logger;
        _change = change;
        _baseUrl = baseUrl;
    }

    /// <summary>
    /// Gets a value indicating whether a whole request path is jellyfin-web's index page
    /// under the configured BaseUrl: exactly {BaseUrl}/web, {BaseUrl}/web/ or {BaseUrl}/web/index.html.
    /// </summary>
    /// <param name="path">The whole request path, its PathBase included.</param>
    /// <param name="baseUrl">The server's BaseUrl, empty or null for none.</param>
    /// <returns>Whether the page is changed on its way out.</returns>
    public static bool IsIndexPage(PathString path, string? baseUrl)
    {
        var root = (baseUrl ?? string.Empty).Trim().TrimEnd('/');
        if (root.Length > 0 && root[0] != '/')
        {
            root = "/" + root;
        }

        var value = path.Value ?? string.Empty;
        return string.Equals(value, root + "/web", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, root + "/web/", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, root + "/web/index.html", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Serves the request, changing the index page.
    /// </summary>
    /// <param name="context">The request.</param>
    /// <returns>A task that completes when the response is written.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var head = HttpMethods.IsHead(request.Method);
        if (!(head || HttpMethods.IsGet(request.Method)) || !IsIndexPage(request.PathBase.Add(request.Path), _baseUrl()))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        // The stock page is asked for whole, uncompressed and unconditional: the client's
        // validators describe the changed page, which only this middleware can answer for.
        var clientTag = request.Headers.IfNoneMatch.ToString();
        foreach (var name in new[] { HeaderNames.AcceptEncoding, HeaderNames.IfNoneMatch, HeaderNames.IfModifiedSince, HeaderNames.Range, HeaderNames.IfRange })
        {
            request.Headers.Remove(name);
        }

        // A HEAD runs as a GET, so its headers describe the page a GET would get.
        if (head)
        {
            request.Method = HttpMethods.Get;
        }

        var response = context.Response;
        var client = response.Body;
        byte[] stock;
        using (var buffer = new MemoryStream())
        {
            response.Body = buffer;
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            finally
            {
                response.Body = client;
                if (head)
                {
                    request.Method = HttpMethods.Head;
                }
            }

            stock = buffer.ToArray();
        }

        var page = stock;
        // Only an HTML page is changed; anything else at that path goes on as it came.
        var html = response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) == true;
        if (response.StatusCode == StatusCodes.Status200OK && html && !response.Headers.ContainsKey(HeaderNames.ContentEncoding))
        {
            page = Change(stock);
            response.Headers.Remove(HeaderNames.LastModified);
            response.Headers.ETag = ETagOf(page);
            if (clientTag.Split(',').Select(tag => tag.Trim()).Any(tag => tag == response.Headers.ETag.ToString() || tag == "*"))
            {
                response.StatusCode = StatusCodes.Status304NotModified;
                response.ContentLength = null;
                return;
            }
        }

        response.ContentLength = page.Length;
        if (!head)
        {
            await client.WriteAsync(page).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Gets the entity tag of a page: a quoted prefix of its SHA-256.
    /// </summary>
    /// <param name="page">The page as sent.</param>
    /// <returns>The entity tag.</returns>
    public static string ETagOf(byte[] page) => "\"" + Convert.ToHexStringLower(SHA256.HashData(page))[..16] + "\"";

    private byte[] Change(byte[] stock)
    {
        try
        {
            var changed = _change(Encoding.UTF8.GetString(stock));
            return changed is null ? stock : Encoding.UTF8.GetBytes(changed);
        }
        catch (Exception exception)
        {
            // A fault can only cost the switcher, never jellyfin-web.
            LogChangeFailed(_logger, exception);
            return stock;
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Adding the account switcher to jellyfin-web failed; serving the page unchanged")]
    private static partial void LogChangeFailed(ILogger logger, Exception exception);
}
