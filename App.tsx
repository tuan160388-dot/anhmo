import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WatermarkPosition, WatermarkOptions } from './types';
import { UploadIcon, DownloadIcon, ImagePlaceholderIcon } from './components/Icons';

declare global {
    interface Window {
        JSZip: any;
    }
}

const ControlHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{children}</h3>
);

const ControlWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mb-6">{children}</div>
);

const Label: React.FC<{ htmlFor: string; children: React.ReactNode; value?: string }> = ({ htmlFor, children, value }) => (
    <label htmlFor={htmlFor} className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <span>{children}</span>
        {value && <span className="text-gray-500 dark:text-gray-400">{value}</span>}
    </label>
);

const applyNoise = (ctx: CanvasRenderingContext2D, amount: number) => {
    if (amount === 0) return;

    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;
    const intensity = amount * 255;

    for (let i = 0; i < data.length; i += 4) {
        const random = (Math.random() - 0.5) * intensity;
        data[i] = data[i] + random;
        data[i + 1] = data[i + 1] + random;
        data[i + 2] = data[i + 2] + random;
    }
    ctx.putImageData(imageData, 0, 0);
};


const applyWatermarkToContext = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    options: WatermarkOptions
) => {
    ctx.font = `${options.fontSize}px Arial`;
    ctx.fillStyle = options.color;
    ctx.globalAlpha = options.opacity;

    const padding = options.fontSize * 0.5;
    let x = 0, y = 0;

    switch (options.position) {
        case WatermarkPosition.TopLeft:
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            x = padding;
            y = padding;
            break;
        case WatermarkPosition.TopCenter:
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            x = canvasWidth / 2;
            y = padding;
            break;
        case WatermarkPosition.TopRight:
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            x = canvasWidth - padding;
            y = padding;
            break;
        case WatermarkPosition.CenterLeft:
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            x = padding;
            y = canvasHeight / 2;
            break;
        case WatermarkPosition.Center:
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            x = canvasWidth / 2;
            y = canvasHeight / 2;
            break;
        case WatermarkPosition.CenterRight:
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            x = canvasWidth - padding;
            y = canvasHeight / 2;
            break;
        case WatermarkPosition.BottomLeft:
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            x = padding;
            y = canvasHeight - padding;
            break;
        case WatermarkPosition.BottomCenter:
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            x = canvasWidth / 2;
            y = canvasHeight - padding;
            break;
        case WatermarkPosition.BottomRight:
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            x = canvasWidth - padding;
            y = canvasHeight - padding;
            break;
    }

    ctx.fillText(options.text, x, y);
    ctx.globalAlpha = 1.0; // Reset for other drawings
};

const App: React.FC = () => {
    const [images, setImages] = useState<File[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>({
        text: 'Bản quyền © 2024',
        fontSize: 48,
        color: '#ffffff',
        opacity: 0.5,
        position: WatermarkPosition.BottomRight,
        noiseLevel: 0,
    });
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setImages(prevImages => [...prevImages, ...newFiles]);
            if (selectedImageIndex === null) {
                setSelectedImageIndex(0);
            }
        }
    };
    
    const removeImage = (indexToRemove: number) => {
        setImages(prevImages => {
            const newImages = prevImages.filter((_, index) => index !== indexToRemove);
            if (newImages.length === 0) {
                setSelectedImageIndex(null);
            } else if (selectedImageIndex === indexToRemove) {
                setSelectedImageIndex(Math.max(0, indexToRemove - 1));
            } else if (selectedImageIndex && selectedImageIndex > indexToRemove) {
                setSelectedImageIndex(selectedImageIndex - 1);
            }
            return newImages;
        });
    };

    const clearAllImages = () => {
        setImages([]);
        setSelectedImageIndex(null);
    }

    const updateWatermarkOption = <K extends keyof WatermarkOptions,>(key: K, value: WatermarkOptions[K]) => {
        setWatermarkOptions(prev => ({ ...prev, [key]: value }));
    };

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || selectedImageIndex === null || !images[selectedImageIndex]) {
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const currentImageFile = images[selectedImageIndex];
        const previewUrl = URL.createObjectURL(currentImageFile);
        const img = new Image();
        img.src = previewUrl;

        img.onload = () => {
            const container = canvas.parentElement;
            if (!container) return;

            const aspectRatio = img.width / img.height;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            let canvasWidth = containerWidth;
            let canvasHeight = containerWidth / aspectRatio;

            if (canvasHeight > containerHeight) {
                canvasHeight = containerHeight;
                canvasWidth = containerHeight * aspectRatio;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            applyNoise(ctx, watermarkOptions.noiseLevel);
            applyWatermarkToContext(ctx, canvas.width, canvas.height, watermarkOptions);
            URL.revokeObjectURL(previewUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(previewUrl);
        };
    }, [images, selectedImageIndex, watermarkOptions]);

    useEffect(() => {
        drawCanvas();
        window.addEventListener('resize', drawCanvas);
        return () => window.removeEventListener('resize', drawCanvas);
    }, [drawCanvas]);


    const handleDownloadAll = async () => {
        if (images.length === 0 || isProcessing) return;

        setIsProcessing(true);
        const zip = new window.JSZip();

        try {
            const watermarkedImagePromises = images.map(file => {
                return new Promise<{ name: string, blob: Blob }>((resolve, reject) => {
                    const img = new Image();
                    const url = URL.createObjectURL(file);
                    img.src = url;

                    img.onload = () => {
                        URL.revokeObjectURL(url);
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = img.naturalWidth;
                        tempCanvas.height = img.naturalHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        if (!tempCtx) return reject(new Error('Could not get canvas context'));
                        
                        tempCtx.drawImage(img, 0, 0);
                        applyNoise(tempCtx, watermarkOptions.noiseLevel);
                        applyWatermarkToContext(tempCtx, tempCanvas.width, tempCanvas.height, watermarkOptions);
                        
                        tempCanvas.toBlob(blob => {
                            if (blob) resolve({ name: file.name, blob });
                            else reject(new Error('Failed to create blob from canvas'));
                        }, file.type, 1);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error(`Failed to load image: ${file.name}`));
                    };
                });
            });

            const watermarkedImages = await Promise.all(watermarkedImagePromises);
            watermarkedImages.forEach(({ name, blob }) => zip.file(name, blob));

            const zipBlob = await zip.generateAsync({ type: 'blob' });

            const link = document.createElement('a');
            link.download = 'watermarked-images.zip';
            link.href = URL.createObjectURL(zipBlob);
            link.click();
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error("Error processing images:", error);
            alert("Đã xảy ra lỗi khi xử lý ảnh. Vui lòng thử lại.");
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="flex flex-col lg:flex-row h-screen font-sans text-gray-900 dark:text-gray-100">
            <aside className="w-full lg:w-[380px] bg-white dark:bg-gray-800 p-6 shadow-lg lg:shadow-none lg:border-r lg:border-gray-200 dark:lg:border-gray-700 overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">Image Watermark Pro</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Thêm dấu ấn cá nhân vào ảnh của bạn.</p>
                </header>
                
                <ControlWrapper>
                    <ControlHeader>1. Tải ảnh lên</ControlHeader>
                     <label htmlFor="image-upload" className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <UploadIcon className="w-6 h-6 text-primary-500"/>
                        <span className="font-semibold text-primary-500">Chọn hoặc kéo thả ảnh</span>
                    </label>
                    <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" multiple />
                </ControlWrapper>
                
                {images.length > 0 && (
                     <ControlWrapper>
                        <div className="flex justify-between items-center mb-2">
                             <ControlHeader>Ảnh đã chọn ({images.length})</ControlHeader>
                             <button onClick={clearAllImages} className="text-sm font-semibold text-red-500 hover:text-red-700">Xóa tất cả</button>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-gray-100 dark:bg-gray-900/50 rounded-lg min-h-[100px]">
                            {images.map((img, index) => (
                                <div key={`${img.name}-${index}`} className="relative flex-shrink-0 group">
                                    <button onClick={() => setSelectedImageIndex(index)} className={`block w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${selectedImageIndex === index ? 'border-primary-500' : 'border-transparent hover:border-primary-300'}`}>
                                        <img src={URL.createObjectURL(img)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                    <button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-opacity opacity-0 group-hover:opacity-100">&times;</button>
                                </div>
                            ))}
                        </div>
                    </ControlWrapper>
                )}
                
                <div className={images.length === 0 ? 'opacity-40 pointer-events-none' : ''}>
                    <ControlWrapper>
                        <ControlHeader>2. Tùy chỉnh Watermark</ControlHeader>
                        <Label htmlFor="watermark-text">Nội dung</Label>
                        <input
                            id="watermark-text"
                            type="text"
                            value={watermarkOptions.text}
                            onChange={(e) => updateWatermarkOption('text', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </ControlWrapper>
    
                    <ControlWrapper>
                        <Label htmlFor="font-size" value={`${watermarkOptions.fontSize}px`}>Cỡ chữ</Label>
                        <input
                            id="font-size"
                            type="range"
                            min="10"
                            max="200"
                            value={watermarkOptions.fontSize}
                            onChange={(e) => updateWatermarkOption('fontSize', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </ControlWrapper>
    
                    <ControlWrapper>
                        <Label htmlFor="opacity" value={`${Math.round(watermarkOptions.opacity * 100)}%`}>Độ mờ</Label>
                        <input
                            id="opacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={watermarkOptions.opacity}
                            onChange={(e) => updateWatermarkOption('opacity', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </ControlWrapper>
    
                    <ControlWrapper>
                        <Label htmlFor="color">Màu sắc</Label>
                         <div className="flex items-center gap-2">
                            <input
                                id="color"
                                type="color"
                                value={watermarkOptions.color}
                                onChange={(e) => updateWatermarkOption('color', e.target.value)}
                                className="p-1 h-10 w-10 block bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 cursor-pointer rounded-lg"
                            />
                            <input
                                type="text"
                                value={watermarkOptions.color}
                                onChange={(e) => updateWatermarkOption('color', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                    </ControlWrapper>

                    <ControlWrapper>
                        <Label htmlFor="position">Vị trí</Label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {Object.values(WatermarkPosition).map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => updateWatermarkOption('position', pos)}
                                    className={`p-3 border-2 rounded-lg transition-colors ${watermarkOptions.position === pos ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/50' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'}`}
                                    aria-label={`Position ${pos}`}
                                >
                                    <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full mx-auto"></div>
                                </button>
                            ))}
                        </div>
                    </ControlWrapper>
                    
                     <ControlWrapper>
                        <ControlHeader>3. Hiệu ứng ảnh</ControlHeader>
                         <Label htmlFor="noise-level" value={`${Math.round(watermarkOptions.noiseLevel * 100)}%`}>Độ nhiễu</Label>
                        <input
                            id="noise-level"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={watermarkOptions.noiseLevel}
                            onChange={(e) => updateWatermarkOption('noiseLevel', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </ControlWrapper>

                    <ControlWrapper>
                        <ControlHeader>4. Tải ảnh về</ControlHeader>
                        <button
                            onClick={handleDownloadAll}
                            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={images.length === 0 || isProcessing}
                        >
                            <DownloadIcon className="w-6 h-6"/>
                            <span>{isProcessing ? 'Đang xử lý...' : `Tải tất cả (${images.length}) dưới dạng .zip`}</span>
                        </button>
                    </ControlWrapper>
                </div>
            </aside>
            <main className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-gray-100 dark:bg-gray-950/50">
                <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
                    {images.length > 0 && selectedImageIndex !== null ? (
                        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"></canvas>
                    ) : (
                        <div className="w-full max-w-xl aspect-video bg-white dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center text-center p-8">
                            <ImagePlaceholderIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Vùng xem trước ảnh</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Tải ảnh lên để bắt đầu thêm watermark.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;