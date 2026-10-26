using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Versioning;
using System.Text.Json;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Plugins;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Jellyfin.Plugin.QuickSwitch.Tests;

public class PluginShapeTests
{
    private static readonly Type[] _pluginTypes = typeof(Plugin).Assembly.GetTypes();

    [Fact]
    public void TargetsNet10()
    {
        var attribute = typeof(Plugin).Assembly.GetCustomAttributes(typeof(TargetFrameworkAttribute), false)
            .Cast<TargetFrameworkAttribute>()
            .Single();

        Assert.Equal(".NETCoreApp,Version=v10.0", attribute.FrameworkName);
    }

    // Jellyfin 12.2 cannot create a plugin derived from the non-generic BasePlugin: it disables the
    // plugin, and GET /Plugins then fails for every plugin on the server.
    [Fact]
    public void PluginHasAConfigurationTypeJellyfinCanCreate()
    {
        var baseType = typeof(Plugin).BaseType!;

        Assert.True(baseType.IsGenericType, $"Plugin derives from {baseType}, expected BasePlugin<TConfiguration>");
        Assert.Equal(typeof(BasePlugin<>), baseType.GetGenericTypeDefinition());
    }

    [Fact]
    public void PluginConfigurationHasNoSettings()
    {
        var configuration = typeof(Plugin).BaseType!.GetGenericArguments().Single();

        Assert.True(typeof(BasePluginConfiguration).IsAssignableFrom(configuration));
        Assert.Empty(configuration.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly));
    }

    [Fact]
    public void NoTypeAddsAnAdminPage()
    {
        Assert.DoesNotContain(_pluginTypes, t => typeof(IHasWebPages).IsAssignableFrom(t));
    }

    [Fact]
    public void ServicesAreRegisteredThroughARegistrator()
    {
        var registrator = _pluginTypes.Single(t => typeof(IPluginServiceRegistrator).IsAssignableFrom(t) && !t.IsAbstract);
        var services = new ServiceCollection();

        ((IPluginServiceRegistrator)Activator.CreateInstance(registrator)!).RegisterServices(services, null!);

        Assert.Contains(services, d => d.ServiceType == typeof(SwitcherScript));
    }

    [Fact]
    public void MetaJsonDeclaresTheTargetAbiAndThePluginId()
    {
        using var meta = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "meta.json")));

        Assert.Equal("12.0.0.0", meta.RootElement.GetProperty("targetAbi").GetString());
        Assert.Equal(Plugin.PluginId, meta.RootElement.GetProperty("guid").GetString());
    }
}
