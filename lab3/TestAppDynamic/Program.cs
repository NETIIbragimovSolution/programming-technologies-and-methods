using System.Globalization;
using System.Reflection;
using System.Runtime.Versioning;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Threading;
using Avalonia.Themes.Fluent;

internal sealed class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    private static AppBuilder BuildAvaloniaApp()
    {
        return AppBuilder.Configure<App>().UsePlatformDetect();
    }
}

internal sealed class App : Application
{
    public App()
    {
        Styles.Add(new FluentTheme());
        RequestedThemeVariant = ThemeVariant.Light;
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new LoginWindow(desktop);
        }

        base.OnFrameworkInitializationCompleted();
    }
}

internal sealed class LoginWindow : Window
{
    private readonly Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime _desktop;
    private readonly DynamicFacade _facade;
    private readonly TextBox _loginBox;
    private readonly TextBox _passwordBox;
    private readonly TextBlock _hintText;
    private readonly TextBlock _inputLanguageText;
    private readonly TextBlock _capsLockText;
    private readonly DispatcherTimer _statusTimer;
    private bool _capsLockOn;
    private string _inputLanguageLabel;

    public LoginWindow(Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
    {
        _desktop = desktop;
        Title = "Вход";
        Width = 700;
        Height = 360;
        CanResize = false;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.Parse("#B8CCE4"));

        _facade = new DynamicFacade();
        _loginBox = new TextBox
        {
            Width = 430,
            Height = 32,
            FontSize = 14,
            Background = Brushes.White,
            BorderBrush = Brushes.Gray,
            BorderThickness = new Thickness(1)
        };
        _passwordBox = new TextBox
        {
            Width = 430,
            Height = 32,
            FontSize = 14,
            PasswordChar = '*',
            Background = Brushes.White,
            BorderBrush = Brushes.Gray,
            BorderThickness = new Thickness(1)
        };
        _hintText = new TextBlock
        {
            Text = "Введите имя пользователя и пароль",
            FontSize = 18,
            HorizontalAlignment = HorizontalAlignment.Right,
            TextAlignment = TextAlignment.Right
        };
        _inputLanguageText = new TextBlock
        {
            FontSize = 14,
            Margin = new Thickness(8, 6, 0, 0)
        };
        _capsLockText = new TextBlock
        {
            FontSize = 14,
            Margin = new Thickness(8, 6, 8, 0),
            HorizontalAlignment = HorizontalAlignment.Right
        };
        _inputLanguageLabel = GetCurrentLanguageLabel();

        var topPanel = new Grid
        {
            Margin = new Thickness(10, 8, 10, 0),
            ColumnDefinitions = new ColumnDefinitions("110,*"),
            RowDefinitions = new RowDefinitions("34,34")
        };
        topPanel.Children.Add(new Border
        {
            Background = Brushes.Gainsboro,
            BorderBrush = Brushes.SlateGray,
            BorderThickness = new Thickness(1),
            Margin = new Thickness(0, 0, 8, 0),
            Child = new TextBlock
            {
                Text = "🔑",
                FontSize = 34,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            }
        });
        var appTitle = new Border
        {
            Background = new SolidColorBrush(Color.Parse("#EDEAC4")),
            BorderBrush = Brushes.SlateGray,
            BorderThickness = new Thickness(1),
            Child = new TextBlock
            {
                Text = "АИС Отдел кадров",
                FontSize = 18,
                Margin = new Thickness(0, 6, 12, 0),
                HorizontalAlignment = HorizontalAlignment.Right
            }
        };
        Grid.SetColumn(appTitle, 1);
        topPanel.Children.Add(appTitle);

        var version = new Border
        {
            Background = new SolidColorBrush(Color.Parse("#F8D606")),
            BorderBrush = Brushes.SlateGray,
            BorderThickness = new Thickness(1),
            Child = new TextBlock
            {
                Text = $"Версия {GetAppVersion()}",
                FontSize = 18,
                Margin = new Thickness(0, 6, 12, 0),
                HorizontalAlignment = HorizontalAlignment.Right
            }
        };
        Grid.SetColumn(version, 1);
        Grid.SetRow(version, 1);
        topPanel.Children.Add(version);

        var loginButton = new Button
        {
            Content = "Вход",
            Width = 150,
            Height = 34,
            FontSize = 14,
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center,
            CornerRadius = new CornerRadius(0)
        };
        loginButton.Click += (_, _) => Login();
        var cancelButton = new Button
        {
            Content = "Отмена",
            Width = 150,
            Height = 34,
            FontSize = 14,
            HorizontalAlignment = HorizontalAlignment.Right,
            HorizontalContentAlignment = HorizontalAlignment.Center,
            VerticalContentAlignment = VerticalAlignment.Center,
            CornerRadius = new CornerRadius(0)
        };
        cancelButton.Click += (_, _) => Close();

        Content = new Grid
        {
            RowDefinitions = new RowDefinitions("74,40,1*,32"),
            Children =
            {
                topPanel,
                new Border
                {
                    Background = Brushes.WhiteSmoke,
                    Margin = new Thickness(10, 0, 10, 0),
                    Padding = new Thickness(8),
                    Child = _hintText,
                    [Grid.RowProperty] = 1
                },
                new StackPanel
                {
                    Margin = new Thickness(20, 14, 20, 12),
                    Spacing = 14,
                    Children =
                    {
                        new StackPanel
                        {
                            Orientation = Orientation.Horizontal,
                            Spacing = 12,
                            Children =
                            {
                                new TextBlock
                                {
                                    Text = "Имя пользователя",
                                    Width = 180,
                                    FontSize = 14,
                                    VerticalAlignment = VerticalAlignment.Center
                                },
                                _loginBox
                            }
                        },
                        new StackPanel
                        {
                            Orientation = Orientation.Horizontal,
                            Spacing = 12,
                            Children =
                            {
                                new TextBlock
                                {
                                    Text = "Пароль",
                                    Width = 180,
                                    FontSize = 14,
                                    VerticalAlignment = VerticalAlignment.Center
                                },
                                _passwordBox
                            }
                        },
                        new Grid
                        {
                            ColumnDefinitions = new ColumnDefinitions("*,*"),
                            Margin = new Thickness(0, 10, 0, 0),
                            Children = { loginButton, cancelButton },
                        }
                    },
                    [Grid.RowProperty] = 2
                },
                new Border
                {
                    Background = Brushes.Gainsboro,
                    BorderBrush = Brushes.SlateGray,
                    BorderThickness = new Thickness(1),
                    Child = new Grid
                    {
                        ColumnDefinitions = new ColumnDefinitions("*,*"),
                        Children =
                        {
                            _inputLanguageText,
                            _capsLockText
                        }
                    },
                    [Grid.RowProperty] = 3
                }
            }
        };

        cancelButton[Grid.ColumnProperty] = 1;
        _capsLockText[Grid.ColumnProperty] = 1;

        KeyDown += OnKeyDown;
        KeyUp += OnKeyUp;
        _loginBox.KeyDown += OnKeyDown;
        _loginBox.KeyUp += OnKeyUp;
        _passwordBox.KeyDown += OnKeyDown;
        _passwordBox.KeyUp += OnKeyUp;
        _loginBox.TextChanged += (_, _) => UpdateLanguageFromText(_loginBox.Text);
        _passwordBox.TextChanged += (_, _) => UpdateLanguageFromText(_passwordBox.Text);
        _statusTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(1)
        };
        _statusTimer.Tick += (_, _) => UpdateDynamicStatus();
        _statusTimer.Start();
        Closed += (_, _) => _statusTimer.Stop();
        UpdateDynamicStatus();
    }

    private void Login()
    {
        var ok = _facade.Authorize(_loginBox.Text ?? string.Empty, _passwordBox.Text ?? string.Empty);
        if (!ok)
        {
            _hintText.Text = "Неверные данные пользователя.";
            _hintText.Foreground = Brushes.DarkRed;
            return;
        }

        _desktop.MainWindow = new MainWindow(_facade);
        _desktop.MainWindow.Show();
        Close();
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.CapsLock)
        {
            _capsLockOn = !_capsLockOn;
            UpdateCapsLockText();
        }
    }

    private void OnKeyUp(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.CapsLock)
        {
            UpdateCapsLockText();
        }
    }

    private void UpdateDynamicStatus()
    {
        _inputLanguageText.Text = $"Язык ввода {_inputLanguageLabel}";
        _capsLockOn = GetCapsLockState(_capsLockOn);
        UpdateCapsLockText();
    }

    private void UpdateCapsLockText()
    {
        _capsLockText.Text = _capsLockOn ? "Клавиша CapsLock нажата" : "Клавиша CapsLock выключена";
    }

    private static bool GetCapsLockState(bool fallback)
    {
        if (!OperatingSystem.IsWindows())
        {
            return fallback;
        }

        try
        {
            return GetCapsLockWindows();
        }
        catch
        {
            return fallback;
        }
    }

    [SupportedOSPlatform("windows")]
    private static bool GetCapsLockWindows()
    {
        return Console.CapsLock;
    }

    private static string GetCurrentLanguageLabel()
    {
        var culture = CultureInfo.CurrentUICulture;
        return culture.NativeName;
    }

    private void UpdateLanguageFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        var ch = text[^1];
        if (IsCyrillic(ch))
        {
            _inputLanguageLabel = "Русский";
        }
        else if (IsLatin(ch))
        {
            _inputLanguageLabel = "Английский";
        }

        _inputLanguageText.Text = $"Язык ввода {_inputLanguageLabel}";
    }

    private static bool IsCyrillic(char ch)
    {
        return ch is >= '\u0400' and <= '\u04FF';
    }

    private static bool IsLatin(char ch)
    {
        return (ch is >= 'A' and <= 'Z') || (ch is >= 'a' and <= 'z');
    }

    private static string GetAppVersion()
    {
        return typeof(LoginWindow).Assembly.GetName().Version?.ToString() ?? "1.0.0.0";
    }
}

internal sealed class MainWindow : Window
{
    private readonly DynamicFacade _facade;
    private readonly TextBlock _statusText;

    public MainWindow(DynamicFacade facade)
    {
        _facade = facade;
        Title = "АИС Отдел кадров";
        Width = 900;
        Height = 600;

        _statusText = new TextBlock();
        var roots = _facade.BuildVisibleMenu();
        var menu = new Menu();
        foreach (var root in roots)
        {
            menu.Items.Add(CreateMenuItem(root));
        }
        menu[DockPanel.DockProperty] = Dock.Top;

        Content = new DockPanel
        {
            LastChildFill = true,
            Children =
            {
                menu,
                new Border
                {
                    Margin = new Thickness(12, 0, 12, 12),
                    Padding = new Thickness(10),
                    [DockPanel.DockProperty] = Dock.Bottom,
                    Child = _statusText
                }
            }
        };
        ShowStatus($"Авторизация успешна. Доступно пунктов: {_facade.CountNodes(roots)}.");
    }

    private void ShowStatus(string message)
    {
        _statusText.Text = message;
    }

    private Avalonia.Controls.MenuItem CreateMenuItem(UiMenuNode node)
    {
        var menuItem = new Avalonia.Controls.MenuItem
        {
            Header = node.Title,
            IsEnabled = node.Status != 1
        };

        if (node.Children.Count > 0 && string.IsNullOrWhiteSpace(node.HandlerName))
        {
            foreach (var child in node.Children)
            {
                menuItem.Items.Add(CreateMenuItem(child));
            }
        }
        else
        {
            menuItem.Click += (_, _) => ShowStatus(_facade.Execute(node));
        }

        return menuItem;
    }
}

internal sealed class UiMenuNode
{
    public required string Title { get; init; }
    public required int Status { get; init; }
    public required string? HandlerName { get; init; }
    public List<UiMenuNode> Children { get; } = new();

    public override string ToString()
    {
        var label = Status == 1 ? " [виден, недоступен]" : string.Empty;
        return Title + label;
    }
}

internal sealed class DynamicFacade
{
    private readonly object _menuManager;
    private readonly object _authManager;
    private readonly Type _menuItemType;
    private readonly MethodInfo _authorizeMethod;
    private readonly MethodInfo _getStatusMethod;
    private readonly MethodInfo _visibleTreeMethod;
    private readonly Dictionary<string, Action> _handlers;
    private object? _authorizedUser;

    public DynamicFacade()
    {
        var baseDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        var menuPath = Path.Combine(baseDir, "menu.txt");
        var usersPath = Path.Combine(baseDir, "users.txt");
        var menuDll = Path.Combine(baseDir, "MenuLib", "bin", "Debug", "net9.0", "MenuLib.dll");
        var authDll = Path.Combine(baseDir, "AuthLib", "bin", "Debug", "net9.0", "AuthLib.dll");

        var menuAsm = Assembly.LoadFrom(menuDll);
        var authAsm = Assembly.LoadFrom(authDll);
        var menuManagerType = menuAsm.GetType("MenuLib.MenuManager") ?? throw new InvalidOperationException("MenuManager type not found.");
        var authManagerType = authAsm.GetType("AuthLib.AuthorizationManager") ?? throw new InvalidOperationException("AuthorizationManager type not found.");
        _menuItemType = menuAsm.GetType("MenuLib.MenuItem") ?? throw new InvalidOperationException("MenuItem type not found.");
        _menuManager = Activator.CreateInstance(menuManagerType, menuPath) ?? throw new InvalidOperationException("MenuManager create failed.");
        _authManager = Activator.CreateInstance(authManagerType, usersPath) ?? throw new InvalidOperationException("AuthorizationManager create failed.");

        _authorizeMethod = authManagerType.GetMethod("Authorize") ?? throw new InvalidOperationException("Authorize method not found.");
        _getStatusMethod = authManagerType.GetMethod("GetStatus", BindingFlags.Public | BindingFlags.Static) ?? throw new InvalidOperationException("GetStatus method not found.");
        _visibleTreeMethod = menuManagerType.GetMethod("BuildVisibleTree") ?? throw new InvalidOperationException("BuildVisibleTree method not found.");
        _handlers = CreateHandlers();
    }

    public bool Authorize(string login, string password)
    {
        _authorizedUser = _authorizeMethod.Invoke(_authManager, [login, password]);
        return _authorizedUser is not null;
    }

    public List<UiMenuNode> BuildVisibleMenu()
    {
        if (_authorizedUser is null) return [];

        Func<string, int> resolver = title => (int)_getStatusMethod.Invoke(null, [_authorizedUser, title])!;
        var treeObj = _visibleTreeMethod.Invoke(_menuManager, [resolver]) ?? throw new InvalidOperationException("Menu build failed.");
        return ToUiTree(treeObj);
    }

    public int CountNodes(IEnumerable<UiMenuNode> roots)
    {
        var count = 0;
        foreach (var root in roots)
        {
            count++;
            count += CountNodes(root.Children);
        }
        return count;
    }

    public string Execute(UiMenuNode node)
    {
        if (node.Status == 1) return $"Пункт \"{node.Title}\" недоступен для этого пользователя.";
        if (node.Children.Count > 0 && string.IsNullOrWhiteSpace(node.HandlerName)) return $"Открыт раздел: {node.Title}";
        if (node.HandlerName is null || !_handlers.TryGetValue(node.HandlerName, out var action))
        {
            return $"Обработчик не найден: {node.HandlerName ?? "<null>"}";
        }

        action();
        return $"Выполнено: {node.Title}";
    }

    private List<UiMenuNode> ToUiTree(object treeObj)
    {
        var roots = new List<UiMenuNode>();
        var enumerable = (System.Collections.IEnumerable)treeObj;
        foreach (var root in enumerable.Cast<object>())
        {
            roots.Add(MapNode(root));
        }
        return roots;
    }

    private UiMenuNode MapNode(object node)
    {
        var title = (string)_menuItemType.GetProperty("Title")!.GetValue(node)!;
        var status = (int)_menuItemType.GetProperty("Status")!.GetValue(node)!;
        var handlerName = (string?)_menuItemType.GetProperty("HandlerName")!.GetValue(node);
        var result = new UiMenuNode
        {
            Title = title,
            Status = status,
            HandlerName = handlerName
        };

        var childrenObj = _menuItemType.GetProperty("Children")!.GetValue(node)!;
        var children = (System.Collections.IEnumerable)childrenObj;
        foreach (var child in children.Cast<object>())
        {
            result.Children.Add(MapNode(child));
        }

        return result;
    }

    private static Dictionary<string, Action> CreateHandlers()
    {
        return new Dictionary<string, Action>(StringComparer.Ordinal)
        {
            ["Others"] = static () => Console.WriteLine("Выбран пункт: Разное"),
            ["Stuff"] = static () => Console.WriteLine("Выбран пункт: Сотрудники"),
            ["Orders"] = static () => Console.WriteLine("Выбран пункт: Приказы"),
            ["Docs"] = static () => Console.WriteLine("Выбран пункт: Документы"),
            ["Departs"] = static () => Console.WriteLine("Выбран пункт: Отделы"),
            ["Towns"] = static () => Console.WriteLine("Выбран пункт: Города"),
            ["Posts"] = static () => Console.WriteLine("Выбран пункт: Должности"),
            ["Window"] = static () => Console.WriteLine("Выбран пункт: Окно"),
            ["Help"] = static () => Console.WriteLine("Выбран пункт: Справка"),
            ["Content"] = static () => Console.WriteLine("Выбран пункт: Оглавление"),
            ["About"] = static () => Console.WriteLine("Выбран пункт: О программе")
        };
    }
}
