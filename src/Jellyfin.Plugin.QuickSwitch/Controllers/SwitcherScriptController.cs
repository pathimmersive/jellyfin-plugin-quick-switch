using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.QuickSwitch.Controllers;

/// <summary>
/// Serves the switcher script that jellyfin-web loads.
/// </summary>
[ApiController]
[Route("QuickSwitch")]
public class SwitcherScriptController : ControllerBase
{
    private readonly SwitcherScript _script;

    /// <summary>
    /// Initializes a new instance of the <see cref="SwitcherScriptController"/> class.
    /// </summary>
    /// <param name="script">The embedded switcher script.</param>
    public SwitcherScriptController(SwitcherScript script)
    {
        _script = script;
    }

    /// <summary>
    /// Serves the switcher script. Anonymous, because a script tag cannot attach an Authorization header,
    /// and the script holds no account data of its own.
    /// </summary>
    /// <returns>The script.</returns>
    [HttpGet(SwitcherScript.FileName)]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult GetScript() => File(_script.Open(), SwitcherScript.ContentType);
}
