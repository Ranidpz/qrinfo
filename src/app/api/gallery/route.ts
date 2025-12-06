import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserGalleryImage } from '@/types';

// POST: Upload a gallery image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const codeId = formData.get('codeId') as string;
    const uploaderName = formData.get('uploaderName') as string;

    if (!file || !codeId) {
      return NextResponse.json(
        { error: 'File and codeId are required' },
        { status: 400 }
      );
    }

    // Validate file type (only images allowed for gallery)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only images allowed' },
        { status: 400 }
      );
    }

    // Validate file size (500KB max - already compressed on client)
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 500KB limit' },
        { status: 400 }
      );
    }

    // Get the code to verify it exists and get owner ID
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const ownerId = codeData.ownerId;

    // Generate unique filename in owner's folder
    const timestamp = Date.now();
    const imageId = `gallery_${timestamp}_${Math.random().toString(36).substring(7)}`;
    const filename = `${ownerId}/${codeId}/gallery/${imageId}.webp`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Create gallery image object
    const galleryImage: UserGalleryImage = {
      id: imageId,
      url: blob.url,
      uploaderName: uploaderName || 'אנונימי',
      uploadedAt: new Date(),
    };

    // Add to userGallery array in Firestore
    await updateDoc(doc(db, 'codes', codeId), {
      userGallery: arrayUnion({
        ...galleryImage,
        uploadedAt: serverTimestamp(),
      }),
      updatedAt: serverTimestamp(),
    });

    // Update owner's storage used
    await updateDoc(doc(db, 'users', ownerId), {
      storageUsed: increment(file.size),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      image: galleryImage,
    });
  } catch (error) {
    console.error('Gallery upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a gallery image (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const { codeId, imageId, imageUrl, userId } = await request.json();

    if (!codeId || !imageId || !imageUrl || !userId) {
      return NextResponse.json(
        { error: 'codeId, imageId, imageUrl, and userId are required' },
        { status: 400 }
      );
    }

    // Verify the user is the owner of the code
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    if (codeData.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Find the image in the gallery to get its size
    const gallery = (codeData.userGallery || []) as Array<{
      id: string;
      url: string;
      uploaderName: string;
      uploadedAt: { toDate?: () => Date } | Date;
    }>;
    const imageToDelete = gallery.find((img) => img.id === imageId);

    if (!imageToDelete) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Delete from Vercel Blob
    try {
      await del(imageUrl);
    } catch (deleteError) {
      console.error('Failed to delete blob:', deleteError);
      // Continue even if blob deletion fails
    }

    // Remove from userGallery array in Firestore
    await updateDoc(doc(db, 'codes', codeId), {
      userGallery: arrayRemove(imageToDelete),
      updatedAt: serverTimestamp(),
    });

    // Estimate image size for storage update (assume ~100KB average for WebP)
    const estimatedSize = 100 * 1024;
    await updateDoc(doc(db, 'users', codeData.ownerId), {
      storageUsed: increment(-estimatedSize),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gallery delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
