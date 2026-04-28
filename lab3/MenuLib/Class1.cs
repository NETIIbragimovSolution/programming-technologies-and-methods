using System.Text.RegularExpressions;

namespace MenuLib;

public sealed class MenuItem
{
    public required string Title { get; init; }
    public required int Level { get; init; }
    public string? HandlerName { get; init; }
    public List<MenuItem> Children { get; } = new();
    public int Status { get; set; }
}

public sealed class MenuManager
{
    private readonly string _menuFilePath;
    private readonly List<MenuItem> _roots = new();

    public MenuManager(string menuFilePath = "menu.txt")
    {
        _menuFilePath = menuFilePath;
        Load();
    }

    public IReadOnlyList<MenuItem> GetTree() => _roots;

    public List<MenuItem> BuildVisibleTree(Func<string, int> statusResolver)
    {
        var result = new List<MenuItem>();
        foreach (var root in _roots)
        {
            var clone = CloneVisible(root, statusResolver);
            if (clone is not null) result.Add(clone);
        }
        return result;
    }

    private MenuItem? CloneVisible(MenuItem node, Func<string, int> statusResolver)
    {
        var status = statusResolver(node.Title);
        if (status == 2) return null;

        var clone = new MenuItem
        {
            Title = node.Title,
            Level = node.Level,
            HandlerName = node.HandlerName,
            Status = status
        };

        foreach (var child in node.Children)
        {
            var clonedChild = CloneVisible(child, statusResolver);
            if (clonedChild is not null) clone.Children.Add(clonedChild);
        }

        return clone;
    }

    private void Load()
    {
        if (!File.Exists(_menuFilePath))
        {
            throw new FileNotFoundException($"Файл меню не найден: {_menuFilePath}");
        }

        var stack = new Stack<MenuItem>();
        foreach (var raw in File.ReadAllLines(_menuFilePath))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("//")) continue;

            var item = ParseLine(line);

            while (stack.Count > item.Level)
            {
                stack.Pop();
            }

            if (item.Level == 0)
            {
                _roots.Add(item);
            }
            else
            {
                if (stack.Count == 0)
                {
                    throw new InvalidDataException($"Нарушена иерархия меню: {line}");
                }
                stack.Peek().Children.Add(item);
            }

            stack.Push(item);
        }
    }

    private static MenuItem ParseLine(string line)
    {
        var tokens = Regex.Split(line, @"\s+")
            .Where(static x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        if (tokens.Length < 2)
        {
            throw new InvalidDataException($"Некорректная строка меню: {line}");
        }

        if (!int.TryParse(tokens[0], out var level) || level < 0)
        {
            throw new InvalidDataException($"Некорректный уровень пункта: {line}");
        }

        var maybeHandler = tokens[^1];
        string? handler = null;
        if (tokens.Length > 2 && maybeHandler is not "0" and not "-")
        {
            handler = maybeHandler;
        }

        var bodyTokens = tokens.Skip(1).Take(tokens.Length - 2).ToList();
        if (bodyTokens.Count > 1 && int.TryParse(bodyTokens[^1], out _))
        {
            bodyTokens.RemoveAt(bodyTokens.Count - 1);
        }

        if (tokens.Length == 2)
        {
            bodyTokens = new List<string> { tokens[1] };
        }

        var title = string.Join(" ", bodyTokens).Trim();
        if (title.Length == 0)
        {
            throw new InvalidDataException($"Пустое название пункта: {line}");
        }

        return new MenuItem
        {
            Title = title,
            Level = level,
            HandlerName = handler
        };
    }
}
