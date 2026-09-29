const CATEGORIES = {
  sports: ['Volleyball', 'Basketball', 'Pickleball', 'Badminton'],
  recreation: ['Pageant', 'Health Program', 'Zumba / Fitness', 'Community Event', 'Other'],
};

function isValidCategory(category, subCategory) {
  return (
    Object.prototype.hasOwnProperty.call(CATEGORIES, category) &&
    CATEGORIES[category].includes(subCategory)
  );
}

module.exports = { CATEGORIES, isValidCategory };