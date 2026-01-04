import { useState, useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
// import { Button } from '@/components/ui/button'; // Unused

const MAX_IMAGES = 4;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

interface ImageUploaderProps {
  images: File[];
  onChange: (images: File[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ images, onChange, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PNG and JPEG images are allowed';
    }
    if (file.size > MAX_SIZE) {
      return 'Image size must be less than 5MB';
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        alert(error);
        return;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });

    if (validFiles.length > 0) {
      onChange([...images, ...validFiles]);
      setPreviews([...previews, ...newPreviews]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onChange(newImages);
    setPreviews(newPreviews);
    
    // Revoke object URL
    URL.revokeObjectURL(previews[index]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => ALLOWED_TYPES.includes(f.type));
    
    if (imageFiles.length > 0) {
      const event = {
        target: { files: imageFiles },
      } as any;
      handleFileSelect(event);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((_image, index) => (
            <div key={index} className="relative group">
              <img
                src={previews[index]}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded border border-[#D7D0C2] bg-[#FBF7ED]"
              />
              {!disabled && (
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 bg-[#1C1B17]/80 text-[#F7F2E6] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length < MAX_IMAGES && !disabled && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-[#D7D0C2] rounded-lg p-4 text-center hover:border-[#1C1B17] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 text-[#6F6A60] mx-auto mb-2" />
          <p className="text-sm font-mono text-[#6F6A60]">
            Click or drag to upload images (max {MAX_IMAGES - images.length} more)
          </p>
          <p className="text-xs font-mono text-[#6F6A60] mt-1">
            PNG or JPEG, max 5MB each
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

