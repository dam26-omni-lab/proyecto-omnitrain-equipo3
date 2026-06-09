const currentPage = window.location.pathname.split('/').pop();

document.querySelectorAll('.nav-link').forEach(link => {
    const linkPage = link.getAttribute('href').split('/').pop();

    if (linkPage === currentPage) {
    link.classList.add('active');
    } else {
    link.classList.remove('active');
    }
});
