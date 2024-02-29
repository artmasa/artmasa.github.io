function loadTheme() {
    var currentTheme = localStorage.getItem('theme');
    if (currentTheme == null) {
        localStorage.setItem('theme', 'light');
    }

    applyTheme();
}

function applyTheme() {
    var currentTheme = localStorage.getItem('theme');
    if (currentTheme == 'dark') {
        document.body.classList.add(currentTheme);
        document.body.classList.remove('light');
    } else {
        document.body.classList.add(currentTheme);
        document.body.classList.remove('dark');
    }
}

function toggleTheme() {
    var theme = localStorage.getItem('theme');
    
    if (theme == 'light') {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }

    document.body.classList.add('toggled');

    applyTheme();

    const event = new Event('theme-toggled');
    document.dispatchEvent(event);
}

loadTheme();