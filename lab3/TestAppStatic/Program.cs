using System.Globalization;
using AuthLib;
using MenuLib;
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
        AppBuilder.Configure<App>().UsePlatformDetect().StartWithClassicDesktopLifetime(args);
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
    private readonly StaticFacade _facade;
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

        _facade = new StaticFacade();
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
        if (!_facade.Authorize(_loginBox.Text ?? string.Empty, _passwordBox.Text ?? string.Empty))
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
        UpdateCapsLockText();
    }

    private void UpdateCapsLockText()
    {
        _capsLockText.Text = _capsLockOn ? "Клавиша CapsLock нажата" : "Клавиша CapsLock выключена";
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
    private readonly StaticFacade _facade;
    private readonly TextBlock _statusText;

    public MainWindow(StaticFacade facade)
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
}

internal sealed class StaticFacade
{
    private readonly AuthorizationManager _auth;
    private readonly MenuManager _menu;
    private readonly Dictionary<string, Action> _handlers;
    private AuthorizedUser? _authorizedUser;

    public StaticFacade()
    {
        var baseDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        var menuPath = Path.Combine(baseDir, "menu.txt");
        var usersPath = Path.Combine(baseDir, "users.txt");
        _auth = new AuthorizationManager(usersPath);
        _menu = new MenuManager(menuPath);
        _handlers = CreateHandlers();
    }

    public bool Authorize(string login, string password)
    {
        _authorizedUser = _auth.Authorize(login, password);
        return _authorizedUser is not null;
    }

    public List<UiMenuNode> BuildVisibleMenu()
    {
        if (_authorizedUser is null) return [];
        var tree = _menu.BuildVisibleTree(title => AuthorizationManager.GetStatus(_authorizedUser, title));
        return tree.Select(MapNode).ToList();
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

    private static UiMenuNode MapNode(MenuLib.MenuItem node)
    {
        var mapped = new UiMenuNode
        {
            Title = node.Title,
            Status = node.Status,
            HandlerName = node.HandlerName
        };

        foreach (var child in node.Children)
        {
            mapped.Children.Add(MapNode(child));
        }

        return mapped;
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
