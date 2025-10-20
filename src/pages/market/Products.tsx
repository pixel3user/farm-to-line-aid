import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  Package, 
  MapPin, 
  Star,
  Eye,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { Product } from '@/types';

const MarketProducts: React.FC = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  // In real mode, products should come from backend queries. Farms aggregation removed.
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | 'none'>('none');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // TODO: Replace with real backend query for market-visible products
        setProducts([]);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.farmName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesGrade = gradeFilter === 'all' || product.grade === gradeFilter;
    
    return matchesSearch && matchesCategory && matchesGrade;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (priceSort === 'asc') return a.price - b.price;
    if (priceSort === 'desc') return b.price - a.price;
    return 0;
  });

  const categories = ['eggs', 'poultry', 'vegetables', 'fruits', 'dairy', 'other'];
  const grades = ['A', 'AA', 'AAA', 'Premium', 'Standard'];

  const getPriceTrend = (product: Product) => {
    // Mock price trend - in real app, this would come from historical data
    const trend = Math.random() > 0.5 ? 'up' : 'down';
    return trend;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('catalog.title')}</h1>
          <p className="text-gray-600">{t('catalog.description')}</p>
        </div>
        <Dialog open={isCompareDialogOpen} onOpenChange={setIsCompareDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              {t('catalog.compare')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t('catalog.productComparison')}</DialogTitle>
              <DialogDescription>
                {t('catalog.comparisonDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">{t('catalog.selectProductsToCompare')}</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder={t('catalog.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('catalog.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('catalog.allCategories')}</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('catalog.grade')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('catalog.allGrades')}</SelectItem>
                  {grades.map(grade => (
                    <SelectItem key={grade} value={grade}>{t('catalog.gradeLabel').replace('{grade}', grade)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priceSort} onValueChange={(value) => setPriceSort(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('catalog.sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('catalog.noSort')}</SelectItem>
                  <SelectItem value="asc">{t('catalog.priceLowToHigh')}</SelectItem>
                  <SelectItem value="desc">{t('catalog.priceHighToLow')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('catalog.availableProducts').replace('{count}', sortedProducts.length.toString())}
          </CardTitle>
          <CardDescription>
            {t('catalog.productsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('catalog.product')}</TableHead>
                  <TableHead>{t('catalog.farm')}</TableHead>
                  <TableHead>{t('catalog.grade')}</TableHead>
                  <TableHead>{t('catalog.unitPack')}</TableHead>
                  <TableHead>{t('catalog.price')}</TableHead>
                  <TableHead>{t('catalog.availability')}</TableHead>
                  <TableHead>{t('catalog.lastUpdated')}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product) => {
                  const priceTrend = getPriceTrend(product);
                  return (
                    <TableRow key={`${product.id}-${product.farmName}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-gray-500">{product.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.farmName}</p>
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {product.farmLocation}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Star className="w-3 h-3 mr-1 text-yellow-500" />
                            {product.farmRating}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t('catalog.gradeLabel').replace('{grade}', product.grade)}</Badge>
                      </TableCell>
                      <TableCell>{product.pack} {product.unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">NT$ {product.price}</span>
                          {priceTrend === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={product.stock < 10 ? 'text-red-600 font-medium' : ''}>
                          {product.stock > 0 ? `${product.stock} ${t('catalog.available')}` : t('catalog.outOfStock')}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(product.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              {t('catalog.productDetails')}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">{t('catalog.productInformation')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.categoryLabel')}</span>
                      <span className="capitalize">{selectedProduct.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.gradeLabel')}</span>
                      <span>{t('catalog.gradeLabel').replace('{grade}', selectedProduct.grade)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.packSize')}</span>
                      <span>{selectedProduct.pack} {selectedProduct.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.priceLabel')}</span>
                      <span className="font-medium">NT$ {selectedProduct.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.stock')}</span>
                      <span>{selectedProduct.stock} {t('catalog.available')}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">{t('catalog.farmInformation')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.farmLabel')}</span>
                      <span>{selectedProduct.farmName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.location')}</span>
                      <span>{selectedProduct.farmLocation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.rating')}</span>
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-500 mr-1" />
                        <span>{selectedProduct.farmRating}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('catalog.lastUpdatedLabel')}</span>
                      <span>{new Date(selectedProduct.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedProduct.description && (
                <div>
                  <h4 className="font-medium mb-2">{t('catalog.description')}</h4>
                  <p className="text-sm text-gray-600">{selectedProduct.description}</p>
                </div>
              )}
              
              <div className="flex space-x-2 pt-4">
                <Button className="flex-1">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t('catalog.contactFarm')}
                </Button>
                <Button variant="outline" className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t('catalog.scheduleDelivery')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketProducts;
