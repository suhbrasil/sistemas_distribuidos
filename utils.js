function normalizeDestination(destination) {
    return destination
        .normalize('NFD')                 // Normaliza caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .toLowerCase()                    // Converte para minúsculas
        .replace(/\s+/g, '_');           // Substitui espaços por underscore
}

module.exports = {
    normalizeDestination
};
