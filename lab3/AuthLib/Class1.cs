namespace AuthLib;

public sealed class AuthorizedUser
{
    public required string Username { get; init; }
    public required Dictionary<string, int> MenuStatuses { get; init; }
}

public sealed class AuthorizationManager
{
    private sealed class UserRecord
    {
        public required string Password { get; init; }
        public required Dictionary<string, int> MenuStatuses { get; init; }
    }

    private readonly Dictionary<string, UserRecord> _users = new(StringComparer.Ordinal);

    public AuthorizationManager(string usersFilePath = "users.txt")
    {
        Load(usersFilePath);
    }

    public AuthorizedUser? Authorize(string username, string password)
    {
        if (!_users.TryGetValue(username, out var record)) return null;
        if (record.Password != password) return null;
        return new AuthorizedUser
        {
            Username = username,
            MenuStatuses = new Dictionary<string, int>(record.MenuStatuses, StringComparer.Ordinal)
        };
    }

    public static int GetStatus(AuthorizedUser user, string menuTitle)
    {
        return user.MenuStatuses.TryGetValue(menuTitle, out var status) ? status : 0;
    }

    private void Load(string usersFilePath)
    {
        if (!File.Exists(usersFilePath))
        {
            throw new FileNotFoundException($"Файл пользователей не найден: {usersFilePath}");
        }

        UserRecord? current = null;
        string? currentUsername = null;

        foreach (var raw in File.ReadAllLines(usersFilePath))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("//")) continue;

            if (line.StartsWith('#'))
            {
                var authData = line[1..].Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (authData.Length < 2)
                {
                    throw new InvalidDataException($"Некорректная запись пользователя: {line}");
                }

                currentUsername = authData[0];
                current = new UserRecord
                {
                    Password = authData[1],
                    MenuStatuses = new Dictionary<string, int>(StringComparer.Ordinal)
                };
                _users[currentUsername] = current;
                continue;
            }

            if (current is null || currentUsername is null)
            {
                throw new InvalidDataException("Статус пункта указан до пользователя");
            }

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2)
            {
                throw new InvalidDataException($"Некорректная запись прав: {line}");
            }

            if (!int.TryParse(parts[^1], out var status) || status < 0 || status > 2)
            {
                throw new InvalidDataException($"Некорректный статус пункта: {line}");
            }

            var title = string.Join(" ", parts[..^1]);
            current.MenuStatuses[title] = status;
        }
    }
}
