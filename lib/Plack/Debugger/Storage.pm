package Plack::Debugger::Storage;

use strict;
use warnings;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use File::Spec;

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must specify a data directory for collecting debugging data"
        unless defined $args{'data_dir'};

    die "You must specify a valid & writable data directory"
        unless -d $args{'data_dir'} && -w $args{'data_dir'};

    foreach (qw[ serializer deserializer ]) {
        die "You must provide a $_ callback"
            unless defined $args{ $_ };

        die "The $_ callback must be a CODE reference"
            unless ref $args{ $_ } 
                && ref $args{ $_ } eq 'CODE';
    }

    bless {
        data_dir     => $args{'data_dir'},
        serializer   => $args{'serializer'},
        deserializer => $args{'deserializer'},
        filename_fmt => $args{'filename_fmt'} || '%s',
    } => $class;
}

# accessors 

sub data_dir     { (shift)->{'data_dir'}     } # directory where collected debugging data is stored
sub serializer   { (shift)->{'serializer'}   } # CODE ref serializer for data into data-dir
sub deserializer { (shift)->{'deserializer'} } # CODE ref deserializer for data into data-dir
sub filename_fmt { (shift)->{'filename_fmt'} } # format string for filename, takes the request UID (optional)

# ...

sub store_request_results {
    my ($self, $request_uid, $results) = @_;
    $self->_store_results( $self->data_dir, (sprintf $self->filename_fmt => $request_uid), $results );
}

sub store_subrequest_results {
    my ($self, $request_uid, $subrequest_uid, $results) = @_;
    my $dir = File::Spec->catfile( $self->data_dir, $request_uid );
    mkdir $dir or die "Could not create $dir because $!"
        unless -e $dir;
    $self->_store_results( $dir, (sprintf $self->filename_fmt => $subrequest_uid), $results );
}

sub load_request_results {
    my ($self, $request_uid) = @_;
    return $self->_load_results( $self->data_dir, (sprintf $self->filename_fmt => $request_uid) );
}

sub load_subrequest_results {
    my ($self, $request_uid, $subrequest_uid) = @_;
    my $dir = File::Spec->catfile( $self->data_dir, $request_uid );
    die "Could not find $dir" unless -e $dir;
    return $self->_load_results( $dir, (sprintf $self->filename_fmt => $subrequest_uid) );
}

sub load_all_subrequest_results {
    my ($self, $request_uid) = @_;
    my $dir = File::Spec->catfile( $self->data_dir, $request_uid );
    return [] unless -e $dir;
    return [
        map {
            $self->_load_results( $dir, (File::Spec->splitpath($_))[2] )
        } glob( File::Spec->catfile( $dir, sprintf $self->filename_fmt => '*' ) )
    ];
}

sub load_all_subrequest_results_modified_since {
    my ($self, $request_uid, $epoch) = @_;
    die "You must specify an epoch to check modification date against"
        unless $epoch;
    my $dir = File::Spec->catfile( $self->data_dir, $request_uid );
    return [] unless -e $dir;
    return [
        map {
            $self->_load_results( $dir, (File::Spec->splitpath($_))[2] )
        } grep {
            (stat( $_ ))[9] > $epoch
        } glob( File::Spec->catfile( $dir, sprintf $self->filename_fmt => '*' ) )
    ];
}

# private utils ...

sub _store_results {
    my ($self, $dir, $filename, $results) = @_;
    my $file = File::Spec->catfile( $dir, $filename );
    my $fh   = IO::File->new( $file, '>' ) or die "Could not open file($file) for writing because: $!";
    $fh->print( $self->serializer->( $results ) );
    $fh->close;
}

sub _load_results {
    my ($self, $dir, $filename) = @_;
    my $file = File::Spec->catfile( $dir, $filename );
    my $fh   = IO::File->new( $file, '<' ) or die "Could not open file($file) for reading because: $!";
    my $results = $self->deserializer->( join '' => <$fh> ) ;
    $fh->close;
    $results;
}


1;

__END__

=pod

=head1 NAME

Plack::Debugger::Storage - The storage manager for debugging data

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut




