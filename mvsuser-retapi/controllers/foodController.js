const Food = require("../models/food");
const { Sequelize } = require('sequelize');
const FoodProduct = require("../models/recipe");
const Product = require("../models/products");
const Category = require("../models/categories");
const FoodCategory = require("../models/foodcategory");
const Comment = require('../models/comments');


exports.create = async (req, res) => {
    if (!req.body.title) {
        res.status(400).send({
            message: "Title and ISBN are required fields!"
        });
        return;
    }

    const foodData = {
        title: req.body.title,
        publishedDate: req.body.publishedDate,
        thumbnailUrl: req.body.thumbnailUrl,
        shortDescription: req.body.shortDescription,
    };

    try {
        const createdFood = await Food.create(foodData);

        if (req.body.products && req.body.products.length > 0) {
            for (const productInfo of req.body.products) {
                const productName = productInfo.name;
                const productQuantity = productInfo.quantity || 1; // Default to 1 if quantity is not provided

                const [product, created] = await Product.findOrCreate({
                    where: { name: productName }
                });

                await FoodProduct.create({
                    FoodId: createdFood.id,
                    ProductId: product.id,
                    quantity: productQuantity
                });
            }
        }

        if (req.body.categories && req.body.categories.length > 0) {
            for (const categoryName of req.body.categories) {
                const [category, created] = await Category.findOrCreate({
                    where: { name: categoryName }
                });

                await FoodCategory.create({
                    FoodId: createdFood.id,
                    CategoryId: category.id
                });
            }
        }

        res.send(createdFood);
    } catch (err) {
        console.error(err);
        res.status(500).send({
            message: err.message || "Some error occurred."
        });
    }
};
exports.findAll = async (req, res) => {
    try {
        const foods = await Food.findAll();
        const foodsWithGenresAndAuthors = [];

        for (const food of foods) {
            const foodCategoryData = await FoodCategory.findAll({
                where: {
                    FoodId: food.id
                }
            });

            const categoryIds = foodCategoryData.map(item => item.CategoryId);

            const categories = await Category.findAll({
                where: {
                    id: categoryIds
                }
            });
            const categoryNames = categories.map(category => category.name);

            const foodProductData = await FoodProduct.findAll({
                where: {
                    FoodId: food.id
                }
            });

            const productIds = foodProductData.map(item => item.ProductId);

            const products = await Product.findAll({
                where: {
                    id: productIds
                }
            });
            const productInfo = products.map(product => ({
                name: product.name,
                quantity: foodProductData.find(item => item.ProductId === product.id).quantity
            }));

            const productCount = await FoodProduct.sum('quantity', {
                where: {
                    FoodId: food.id
                }
            });

            foodsWithGenresAndAuthors.push({
                _id: food.id,
                title: food.title,
                publishedDate: food.publishedDate,
                thumbnailUrl: food.thumbnailUrl,
                shortDescription: food.shortDescription,
                products: {
                    count: productCount,
                    products: productInfo
                },
                categories: categoryNames
            });
        }

        res.send(foodsWithGenresAndAuthors);
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred."
        });
    }
};


exports.update = async (req, res) => {
    const foodId = req.params.id;

    if (!foodId) {
        res.status(400).send({
            message: "Food ID is required."
        });
        return;
    }

    try {
        const food = await Food.findByPk(foodId);

        if (!food) {
            res.status(404).send({
                message: `Food with ID ${foodId} not found.`
            });
            return;
        }

        food.title = req.body.title || food.title;
        food.publishedDate = req.body.publishedDate || food.publishedDate;
        food.thumbnailUrl = req.body.thumbnailUrl || food.thumbnailUrl;
        food.shortDescription = req.body.shortDescription || food.shortDescription;

        await food.save();

        if (req.body.products && req.body.products.length > 0) {
            const productIds = [];
            for (const productName of req.body.products) {
                const [product, created] = await Product.findOrCreate({
                    where: { name: productName }
                });
                productIds.push(product.id);
                await FoodProduct.findOrCreate({
                    where: {
                        FoodId: food.id,
                        ProductId: product.id
                    }
                });
            }
            await FoodProduct.destroy({
                where: {
                    FoodId: food.id,
                    ProductId: { [Sequelize.Op.notIn]: productIds }
                }
            });
        }

        if (req.body.categories && req.body.categories.length > 0) {
            const categoryIds = [];
            for (const categoryName of req.body.categories) {
                const [category, created] = await Category.findOrCreate({
                    where: { name: categoryName }
                });
                categoryIds.push(category.id);
                await FoodCategory.findOrCreate({
                    where: {
                        FoodId: food.id,
                        CategoryId: category.id
                    }
                });
            }
            await FoodCategory.destroy({
                where: {
                    FoodId: food.id,
                    CategoryId: { [Sequelize.Op.notIn]: categoryIds }
                }
            });
        }

        res.send({
            message: `Food with ID ${foodId} has been updated successfully.`
        });
    } catch (err) {
        res.status(500).send({
            message: err.message || "Some error occurred while updating the food."
        });
    }
};

exports.delete = async (req, res) => {
    const foodId = req.params.id;

    if (!foodId) {
        res.status(400).send({
            message: "Food ID is required."
        });
        return;
    }

    try {
        // Удаление связанных комментариев
        await Comment.destroy({
            where: {
                foodId: foodId
            }
        });

        // Удаление связанных записей из FoodCategory и FoodProduct
        await FoodCategory.destroy({
            where: {
                FoodId: foodId
            }
        });
        await FoodProduct.destroy({
            where: {
                FoodId: foodId
            }
        });

        // Удаление блюда
        await Food.destroy({
            where: {
                id: foodId
            }
        });

        res.send({
            message: `Food with ID ${foodId} has been deleted successfully.`
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({
            message: err.message || "Some error occurred while deleting the food."
        });
    }
};


exports.searchByTitle = (req, res) => {
    const searchTerm = req.query.searchTerm;

    if (!searchTerm) {
        res.status(400).send({
            message: "Search term is required."
        });
        return;
    }

    Food.findAll({
        where: {
            title: {
                [Sequelize.Op.like]: `%${searchTerm}%`
            }
        }
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred."
            });
        });
};
exports.findByProductName = async (req, res) => {
    try {
        const productName = req.params.name;

        if (!productName) {
            res.status(400).send({
                message: "Product name is required."
            });
            return;
        }

        const productData = await Product.findOne({
            where: {
                name: productName
            }
        });

        if (!productData) {
            res.status(404).send({
                message: `Product with name '${productName}' not found.`
            });
            return;
        }

        const foodProductData = await FoodProduct.findAll({
            where: {
                ProductId: productData.id
            }
        });

        const foodIds = foodProductData.map(item => item.FoodId);

        const foodsData = await Food.findAll({
            where: {
                id: foodIds
            }
        });

        res.send(foodsData);
    } catch (err) {
        console.error(err);
        res.status(500).send({
            message: err.message || "Some error occurred."
        });
    }
};

exports.findByCategory = (req, res) => {
    const categoryName = req.params.name;

    if (!categoryName) {
        res.status(400).send({
            message: "Category name is required."
        });
        return;
    }

    Category.findOne({
        where: {
            name: categoryName
        }
    })
    .then(categoryData => {
        if (!categoryData) {
            res.status(404).send({
                message: `Category with name '${categoryName}' not found.`
            });
            return;
        }

        FoodCategory.findAll({
            where: {
                CategoryId: categoryData.id
            }
        })
        .then(foodCategoryData => {

            const foodIds = foodCategoryData.map(item => item.FoodId);

            Food.findAll({
                where: {
                    id: foodIds
                }
            })
            .then(data => {
                res.send(data);
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred."
                });
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred."
            });
        });
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "Some error occurred."
        });
    });
};
