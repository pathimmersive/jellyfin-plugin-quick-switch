using System;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.QuickSwitch.Controllers;

/// <summary>
/// Serves the switcher script that jellyfin-web loads, and its stylesheet.
/// </summary>
[ApiController]
[Route("QuickSwitch")]
public class SwitcherScriptController : ControllerBase
{
    private readonly SwitcherScript _script;

    /// <summary>
    /// Initializes a new instance of the <see cref="SwitcherScriptController"/> class.
    /// </summary>
    /// <param name="script">The embedded switcher script and stylesheet.</param>
    public SwitcherScriptController(SwitcherScript script)
    {
        _script = script;
    }

    /// <summary>
    /// Serves the switcher script. Anonymous, because a script tag cannot attach an Authorization header,
    /// and the script holds no account data of its own. Clients revalidate it on every load, so a rebuilt
    /// plugin reaches them even when its version is unchanged.
    /// </summary>
    /// <returns>The script, or 304 when the client already has it.</returns>
    [HttpGet(SwitcherScript.FileName)]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public ActionResult GetScript() => Serve(_script.ETag, _script.Open, SwitcherScript.ContentType);

    /// <summary>
    /// Serves the switcher's stylesheet, which the script links from beside itself. Anonymous and
    /// revalidated on every load, like the script.
    /// </summary>
    /// <returns>The stylesheet, or 304 when the client already has it.</returns>
    [HttpGet(SwitcherScript.StyleFileName)]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public ActionResult GetStyle() => Serve(_script.StyleETag, _script.OpenStyle, SwitcherScript.StyleContentType);

    private ActionResult Serve(string etag, Func<Stream> open, string contentType)
    {
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.ETag = etag;
        if (ClientHas(etag))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(open(), contentType);
    }

    // If-None-Match may list several entity tags, in one header or several.
    private bool ClientHas(string etag) =>
        Request.Headers.IfNoneMatch
            .SelectMany(value => (value ?? string.Empty).Split(',', StringSplitOptions.TrimEntries))
            .Any(candidate => candidate == etag || candidate == "*");
}
